-- =====================================================================
-- 0300 S3 billing (owner: S3, reviewed by the lead). Baseline shipped by Core.
-- D-1, D-3, D-4, D-5, D-15…D-23. Keep every function name and parameter list.
-- =====================================================================

-- ---------- Build one invoice for the subscription's next period ------
-- Internal: called by run_billing under a savepoint with the subscription row locked.
create or replace function public.bill_next_period(p_sub_id uuid, p_run_id bigint, p_generated_on date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s        subscriptions;
  pl       plans;
  c        customers;
  pt       payment_terms;
  v_inv    uuid;
  v_start  date;
  v_end    date;
  r        record;
  v_best   record;
  v_amt    numeric;
  v_left   numeric;
  v_base   numeric;
  v_last   uuid;
begin
  select * into s  from subscriptions where id = p_sub_id;
  select * into pl from plans where id = s.plan_id;
  select * into c  from customers where id = s.customer_id;
  select * into pt from payment_terms where id = s.payment_term_id;

  v_start := public.add_period(s.billing_anchor, pl.billing_period, s.periods_billed);
  v_end   := public.add_period(s.billing_anchor, pl.billing_period, s.periods_billed + 1) - 1;

  -- unique (subscription_id, period_start) where not cancelled → a second bill raises unique_violation
  insert into invoices (subscription_id, customer_id, billing_run_id, period_start, period_end, invoice_date, due_date,
                        customer_snapshot, payment_term_name, payment_term_days)
  values (s.id, s.customer_id, p_run_id, v_start, v_end, v_start, p_generated_on + coalesce(pt.days, 0),
          jsonb_build_object('name', c.name, 'company_name', c.company_name, 'email', c.email,
                             'phone', c.phone, 'address', c.address, 'gstin', c.gstin),
          pt.name, pt.days)
  returning id into v_inv;

  -- 1. Lines (D-1): plan fee (if > 0) then one line per subscription line, with tax snapshot (D-4, D-5)
  if pl.price > 0 then
    insert into invoice_lines (invoice_id, kind, description, quantity, unit_price, amount, tax_name, tax_rate, total, sort_order)
    select v_inv, 'plan_fee', pl.name || ' (' || to_char(v_start, 'DD Mon YYYY') || ' – ' || to_char(v_end, 'DD Mon YYYY') || ')',
           1, pl.price, pl.price, t.name, coalesce(t.rate_percent, 0), pl.price, -1
      from (select 1) one left join taxes t on t.id = pl.tax_id;
  end if;
  insert into invoice_lines (invoice_id, kind, product_id, variant_id, description, quantity, unit_price, amount,
                             tax_name, tax_rate, total, sort_order)
  select v_inv, 'product', l.product_id, l.variant_id, l.description, l.quantity, l.unit_price,
         round(l.quantity * l.unit_price, 2), t.name, coalesce(t.rate_percent, 0), round(l.quantity * l.unit_price, 2), l.sort_order
    from subscription_lines l left join taxes t on t.id = l.tax_id
   where l.subscription_id = s.id;

  -- 2. One discount (D-21, D-22): best saving among the rules that fit; reserve its use atomically (D-23)
  for v_best in
    select d.id, d.name, x.saving
      from discount_rules d
      cross join lateral (
        select coalesce(sum(il.amount), 0) as base,
               coalesce(sum(il.quantity) filter (where il.kind = 'product'), 0) as qty
          from invoice_lines il
         where il.invoice_id = v_inv
           and (d.scope = 'subscription'
                or (il.kind = 'product' and il.product_id in (select product_id from discount_rule_products where rule_id = d.id)))
      ) e
      cross join lateral (select case d.kind when 'percent' then round(e.base * d.value / 100, 2)
                                             else least(d.value, e.base) end as saving) x
     where d.is_active
       and v_start >= d.starts_on and (d.ends_on is null or v_start <= d.ends_on)
       and (d.usage_limit is null or d.used_count < d.usage_limit)
       and (d.condition = 'none'
            or (d.condition = 'min_purchase' and e.base >= d.condition_value)
            or (d.condition = 'min_quantity' and e.qty  >= d.condition_value))
       and x.saving > 0
     order by x.saving desc, d.ends_on asc nulls last, d.id
  loop
    update discount_rules set used_count = used_count + 1
     where id = v_best.id and (usage_limit is null or used_count < usage_limit);
    if found then
      -- spread over eligible lines in proportion; rounding remainder on the largest line (D-3)
      select coalesce(sum(il.amount), 0) into v_base
        from invoice_lines il
       where il.invoice_id = v_inv
         and ((select scope from discount_rules where id = v_best.id) = 'subscription'
              or (il.kind = 'product' and il.product_id in (select product_id from discount_rule_products where rule_id = v_best.id)));
      v_amt := v_best.saving; v_left := v_amt; v_last := null;
      for r in
        select il.id, il.amount from invoice_lines il
         where il.invoice_id = v_inv
           and ((select scope from discount_rules where id = v_best.id) = 'subscription'
                or (il.kind = 'product' and il.product_id in (select product_id from discount_rule_products where rule_id = v_best.id)))
         order by il.amount desc, il.sort_order, il.id
      loop
        if v_last is null then v_last := r.id; continue; end if;     -- largest line takes the remainder
        update invoice_lines set discount_amount = round(v_amt * r.amount / v_base, 2) where id = r.id;
        v_left := v_left - round(v_amt * r.amount / v_base, 2);
      end loop;
      update invoice_lines set discount_amount = v_left where id = v_last;
      insert into discount_redemptions (rule_id, invoice_id, amount) values (v_best.id, v_inv, v_amt);
      update invoices set discount_rule_id = v_best.id, discount_name = v_best.name where id = v_inv;
      exit;
    end if;
  end loop;

  -- 3. Tax on the discounted amount, rounded per line (D-3)
  update invoice_lines
     set tax_amount = round((amount - discount_amount) * tax_rate / 100, 2),
         total      = amount - discount_amount + round((amount - discount_amount) * tax_rate / 100, 2)
   where invoice_id = v_inv;

  -- 4. Totals are sums of rounded lines
  update invoices i
     set subtotal = x.sub, discount_total = x.disc, tax_total = x.tax, total = x.sub - x.disc + x.tax
    from (select sum(amount) as sub, sum(discount_amount) as disc, sum(tax_amount) as tax
            from invoice_lines where invoice_id = v_inv) x
   where i.id = v_inv;

  -- 5. Advance to the next period
  perform public.enter_lifecycle();
  update subscriptions set periods_billed = periods_billed + 1, next_invoice_date = v_end + 1 where id = s.id;
  return v_inv;
end $$;

-- ---------- The billing run (BILL-1, BILL-4, D-15…D-18) --------------
-- p_generated_on is the "today" used for due dates; the public wrapper always passes today_ist().
create or replace function public.run_billing_core(p_as_of date, p_trigger billing_trigger, p_generated_on date)
returns billing_runs language plpgsql security definer set search_path = public as $$
declare
  v_run    billing_runs;
  r        record;
  v_n      int;
  v_created int := 0; v_skipped int := 0; v_failed int := 0;
  v_fail   jsonb := '[]';
  v_err    text;
begin
  if not pg_try_advisory_xact_lock(hashtext('brightloop.run_billing')) then
    raise exception 'BILLING_RUN_IN_PROGRESS: another billing run is in progress' using errcode = 'P0001';
  end if;
  insert into billing_runs (as_of, trigger, triggered_by) values (p_as_of, p_trigger, auth.uid()) returning * into v_run;

  perform public.process_lifecycle(p_as_of);

  for r in
    select s.id, s.number from subscriptions s
     where s.status = 'active' and not s.is_paused and s.next_invoice_date <= p_as_of
       and (s.expiry_date is null or s.next_invoice_date < s.expiry_date)
     order by s.next_invoice_date, s.id
     for update skip locked
  loop
    v_n := 0;
    begin                                              -- savepoint: one failure never aborts the batch
      loop                                             -- catch up: one invoice per missed period
        exit when not exists (
          select 1 from subscriptions s where s.id = r.id and s.status = 'active' and not s.is_paused
             and s.next_invoice_date <= p_as_of and (s.expiry_date is null or s.next_invoice_date < s.expiry_date));
        perform public.bill_next_period(r.id, v_run.id, p_generated_on);
        v_n := v_n + 1;
      end loop;
      v_created := v_created + v_n;
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;                    -- already billed for that period
      when others then
        get stacked diagnostics v_err = message_text;
        v_failed := v_failed + 1;
        v_fail := v_fail || jsonb_build_object('subscription_id', r.id, 'number', r.number, 'reason', v_err);
    end;
  end loop;

  perform public.process_lifecycle(p_as_of);          -- expire what is now fully billed

  update billing_runs set finished_at = clock_timestamp(), created_count = v_created, skipped_count = v_skipped,
         failed_count = v_failed, failures = v_fail
   where id = v_run.id returning * into v_run;
  return v_run;
end $$;

create or replace function public.run_billing(p_as_of date default null, p_trigger billing_trigger default 'manual')
returns billing_runs language plpgsql security definer set search_path = public as $$
begin
  perform public.require_internal();   -- staff, admin, or pg_cron / service role
  return public.run_billing_core(coalesce(p_as_of, public.today_ist()), p_trigger, public.today_ist());
end $$;

-- ---------- Dry run (Should) -----------------------------------------
create or replace function public.preview_billing(p_as_of date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_as_of date := coalesce(p_as_of, public.today_ist()); v jsonb;
begin
  perform public.require_internal();
  select jsonb_build_object(
           'as_of', v_as_of,
           'subscriptions', count(*),
           'sample', coalesce(jsonb_agg(jsonb_build_object('id', id, 'number', number, 'next_invoice_date', next_invoice_date))
                              filter (where rn <= 20), '[]'))
    into v
    from (select s.id, s.number, s.next_invoice_date, row_number() over (order by s.next_invoice_date, s.id) as rn
            from subscriptions s
           where s.status = 'active' and not s.is_paused and s.next_invoice_date <= v_as_of
             and (s.expiry_date is null or s.next_invoice_date < s.expiry_date)) d;
  return v;
end $$;

-- ---------- Invoice actions (BILL-3, D-20, D-23) ----------------------
create or replace function public.invoice_confirm(p_id uuid)
returns invoices language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  perform public.require_internal();
  update invoices
     set status = case when total = 0 then 'paid'::invoice_status else 'confirmed' end,
         confirmed_at = now(), paid_at = case when total = 0 then now() end
   where id = p_id and status = 'draft' returning * into i;
  if not found then
    if not exists (select 1 from invoices where id = p_id) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    raise exception 'INVALID_TRANSITION: only Draft invoices can be confirmed' using errcode = 'P0001';
  end if;
  update discount_redemptions set state = 'committed' where invoice_id = p_id and state = 'reserved';
  return i;
end $$;

create or replace function public.invoice_confirm_many(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ok int; v_skipped jsonb;
begin
  perform public.require_internal();
  select coalesce(jsonb_agg(jsonb_build_object('id', x, 'reason', coalesce('status is ' || i.status::text, 'not found'))), '[]')
    into v_skipped
    from unnest(p_ids) x left join invoices i on i.id = x
   where i.status is distinct from 'draft';
  with u as (
    update invoices
       set status = case when total = 0 then 'paid'::invoice_status else 'confirmed' end,
           confirmed_at = now(), paid_at = case when total = 0 then now() end
     where id = any(p_ids) and status = 'draft' returning id),
  r as (update discount_redemptions set state = 'committed' where invoice_id in (select id from u) and state = 'reserved')
  select count(*) into v_ok from u;
  return jsonb_build_object('confirmed', v_ok, 'skipped', v_skipped);
end $$;

create or replace function public.invoice_cancel(p_id uuid, p_reason text)
returns invoices language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  perform public.require_internal();
  select * into i from invoices where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if i.status not in ('draft', 'confirmed') or i.amount_paid > 0 then
    raise exception 'CANNOT_CANCEL: only Draft or Confirmed invoices without payments' using errcode = 'P0001';
  end if;
  update invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason where id = p_id returning * into i;
  -- give the discount use back (D-23)
  update discount_rules d set used_count = used_count - 1
    from discount_redemptions r
   where r.invoice_id = p_id and r.state in ('reserved', 'committed') and d.id = r.rule_id;
  update discount_redemptions set state = 'released' where invoice_id = p_id and state in ('reserved', 'committed');
  return i;
end $$;

create or replace function public.invoice_mark_sent(p_id uuid)
returns invoices language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  perform public.require_internal();
  update invoices set sent_at = now() where id = p_id and status in ('confirmed', 'paid') returning * into i;
  if not found then raise exception 'INVOICE_NOT_CONFIRMED: only Confirmed or Paid invoices can be sent' using errcode = 'P0001'; end if;
  return i;
end $$;

-- ---------- Scheduler (D-19): daily at 00:30 IST, only when enabled ---
create or replace function public.scheduled_billing() returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((select (value #>> '{}')::boolean from app_settings where key = 'scheduler_enabled'), false) then
    perform public.run_billing(public.today_ist(), 'scheduled');
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('brightloop-billing', '0 19 * * *', 'select public.scheduled_billing()');  -- 19:00 UTC = 00:30 IST
  end if;
exception when others then
  raise notice 'pg_cron not set up: %', sqlerrm;
end $$;

-- ---------- Function privileges ---------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default. Close that,
-- then grant only what the API calls. Every new function in this file must be listed here.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.bill_next_period(uuid, bigint, date), public.run_billing_core(date, billing_trigger, date),
                           public.scheduled_billing() from public, anon, authenticated;
grant execute on function
  public.run_billing(date, billing_trigger), public.preview_billing(date),
  public.invoice_confirm(uuid), public.invoice_confirm_many(uuid[]), public.invoice_cancel(uuid, text),
  public.invoice_mark_sent(uuid)
to authenticated;
