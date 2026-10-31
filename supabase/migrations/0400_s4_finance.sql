-- =====================================================================
-- 0400 S4 finance (owner: S4). Baseline shipped by Core. D-24, D-25.
-- Keep every function name and parameter list.
-- =====================================================================

-- ---------- Record a payment (PAY-1, D-24) ---------------------------
create or replace function public.record_payment(p_invoice_id uuid, p_amount numeric, p_method payment_method,
                                                 p_paid_on date default null, p_note text default null)
returns invoices language plpgsql security definer set search_path = public as $$
declare i invoices;
begin
  perform public.require_internal();
  select * into i from invoices where id = p_invoice_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if i.status <> 'confirmed' then
    raise exception 'INVOICE_NOT_CONFIRMED: payments can only be recorded on Confirmed invoices' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'VALIDATION_ERROR: amount must be greater than 0' using errcode = 'P0001';
  end if;
  if p_amount > i.amount_due then
    raise exception 'AMOUNT_EXCEEDS_DUE: balance is %', i.amount_due using errcode = 'P0001';
  end if;
  insert into payments (invoice_id, customer_id, method, amount, paid_on, note, recorded_by)
  values (i.id, i.customer_id, p_method, p_amount, coalesce(p_paid_on, public.today_ist()), p_note, auth.uid());
  update invoices
     set amount_paid = amount_paid + p_amount,
         status  = case when amount_paid + p_amount = total then 'paid'::invoice_status else status end,
         paid_at = case when amount_paid + p_amount = total then now() else paid_at end
   where id = i.id returning * into i;
  return i;
end $$;

-- ---------- Summary KPIs (REP-1, REP-2, D-25) -------------------------
create or replace function public.report_summary(p_from date, p_to date, p_plan_id uuid default null, p_customer_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_today date := public.today_ist();
begin
  perform public.require_internal();
  with subs as (
    select s.id, s.status, s.is_paused, s.pause_reason, p.billing_period,
           p.price + coalesce((select sum(round(l.quantity * l.unit_price, 2)) from subscription_lines l where l.subscription_id = s.id), 0) as per_period
      from subscriptions s join plans p on p.id = s.plan_id
     where s.status = 'active'
       and (p_plan_id is null or s.plan_id = p_plan_id) and (p_customer_id is null or s.customer_id = p_customer_id)
  ), inv as (
    select i.status, i.total, i.amount_due, i.due_date, i.invoice_date
      from invoices i join subscriptions s on s.id = i.subscription_id
     where (p_plan_id is null or s.plan_id = p_plan_id) and (p_customer_id is null or i.customer_id = p_customer_id)
  ), pay as (
    select pm.amount from payments pm join invoices i on i.id = pm.invoice_id join subscriptions s on s.id = i.subscription_id
     where pm.paid_on between p_from and p_to
       and (p_plan_id is null or s.plan_id = p_plan_id) and (p_customer_id is null or pm.customer_id = p_customer_id)
  ), m as (
    select coalesce(sum(round(per_period * public.monthly_factor(billing_period), 2)) filter (where not is_paused), 0) as mrr from subs
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'active_subscriptions', (select count(*) from subs where not is_paused),
    'paused_subscriptions', (select count(*) from subs where pause_reason = 'manual'),
    'out_of_term_subscriptions', (select count(*) from subs where pause_reason = 'out_of_term'),
    'revenue_received', (select coalesce(sum(amount), 0) from pay),
    'payments_count',   (select count(*) from pay),
    'invoiced',         (select coalesce(sum(total), 0) from inv where status in ('confirmed', 'paid') and invoice_date between p_from and p_to),
    'outstanding',      (select coalesce(sum(amount_due), 0) from inv where status = 'confirmed'),
    'overdue_count',    (select count(*) from inv where status = 'confirmed' and amount_due > 0 and due_date < v_today),
    'overdue_amount',   (select coalesce(sum(amount_due), 0) from inv where status = 'confirmed' and amount_due > 0 and due_date < v_today),
    'mrr', (select mrr from m),
    'arr', (select mrr * 12 from m)
  ) into v;
  return v;
end $$;

-- ---------- Revenue series: received vs invoiced per bucket -----------
create or replace function public.report_revenue(p_from date, p_to date, p_bucket text default 'month')
returns table (period date, received numeric, invoiced numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_internal();
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'VALIDATION_ERROR: bucket must be day, week or month' using errcode = 'P0001';
  end if;
  return query
  with r as (select date_trunc(p_bucket, paid_on)::date as b, sum(amount) as amt
               from payments where paid_on between p_from and p_to group by 1),
       i as (select date_trunc(p_bucket, invoice_date)::date as b, sum(total) as amt
               from invoices where status in ('confirmed', 'paid') and invoice_date between p_from and p_to group by 1),
       g as (select generate_series(date_trunc(p_bucket, p_from), date_trunc(p_bucket, p_to), ('1 ' || p_bucket)::interval)::date as b)
  select g.b, coalesce(r.amt, 0)::numeric, coalesce(i.amt, 0)::numeric
    from g left join r on r.b = g.b left join i on i.b = g.b
   order by g.b;
end $$;

-- ---------- Overdue by age bucket (PAY-2) ----------------------------
create or replace function public.report_overdue()
returns table (bucket text, invoices bigint, amount numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_internal();
  return query
  with o as (
    select public.today_ist() - due_date as age, amount_due from invoices
     where status = 'confirmed' and amount_due > 0 and due_date < public.today_ist())
  select b.bucket, count(o.age), coalesce(sum(o.amount_due), 0)::numeric
    from (values ('0-30', 1, 30, 1), ('31-60', 31, 60, 2), ('61-90', 61, 90, 3), ('90+', 91, 1000000, 4)) as b(bucket, lo, hi, ord)
    left join o on o.age between b.lo and b.hi
   group by b.bucket, b.ord order by b.ord;
end $$;

-- ---------- Renewals widget (Should, D-9) -----------------------------
create or replace function public.report_renewals(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  perform public.require_internal();
  select jsonb_build_object(
    'expiring_count', (select count(*) from subscriptions where status = 'active' and pause_reason is distinct from 'out_of_term'
                         and expiry_date between public.today_ist() and public.today_ist() + p_days),
    'out_of_term_count', (select count(*) from subscriptions where pause_reason = 'out_of_term'),
    'expiring', coalesce((select jsonb_agg(x) from (
        select id, number, customer_name, plan_name, expiry_date from subscription_list
         where status = 'active' and not is_out_of_term and expiry_date between public.today_ist() and public.today_ist() + p_days
         order by expiry_date limit 20) x), '[]'),
    'out_of_term', coalesce((select jsonb_agg(x) from (
        select id, number, customer_name, plan_name, expiry_date from subscription_list
         where is_out_of_term order by expiry_date limit 20) x), '[]')
  ) into v;
  return v;
end $$;

-- ---------- Function privileges ---------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default. Close that,
-- then grant only what the API calls. Every new function in this file must be listed here.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.record_payment(uuid, numeric, payment_method, date, text),
  public.report_summary(date, date, uuid, uuid),
  public.report_revenue(date, date, text),
  public.report_overdue(),
  public.report_renewals(int)
to authenticated;
