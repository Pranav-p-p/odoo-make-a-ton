-- =====================================================================
-- 0200 S2 lifecycle (owner: S2). Baseline shipped by Core; S2 completes it to D-2, D-5…D-14.
-- Keep every function name and parameter list: S3 calls process_lifecycle, the API calls the rest.
-- =====================================================================

-- Write a history row (internal helper)
create or replace function public.sub_log(p_id uuid, p_from subscription_status, p_to subscription_status,
                                          p_event text, p_note text default null) returns void
language sql security definer set search_path = public as $$
  insert into subscription_status_history (subscription_id, from_status, to_status, event, note, changed_by)
  values (p_id, p_from, p_to, p_event, p_note, auth.uid())
$$;

-- D-2: quantity of main product lines (add-ons excluded) must reach the plan minimum
create or replace function public.sub_check_min_quantity(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_qty numeric; v_min int;
begin
  select coalesce(sum(l.quantity) filter (where pr.type <> 'addon'), 0), max(pl.min_quantity)
    into v_qty, v_min
    from subscriptions s join plans pl on pl.id = s.plan_id
    left join subscription_lines l on l.subscription_id = s.id
    left join products pr on pr.id = l.product_id
   where s.id = p_id;
  if v_qty < v_min then
    raise exception 'BELOW_MIN_QUANTITY: main product quantity % is below the plan minimum %', v_qty, v_min using errcode = 'P0001';
  end if;
end $$;

-- Who may act on this subscription: internal staff, or the owning customer
create or replace function public.sub_load(p_id uuid, out s subscriptions, out pl plans, out internal boolean, out owner boolean)
language plpgsql security definer set search_path = public as $$
begin
  select * into s from subscriptions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  internal := public.is_internal();
  owner    := coalesce(s.customer_id = public.my_customer_id(), false) and s.status <> 'draft';
  if not (internal or owner) then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select * into pl from plans where id = s.plan_id;
end $$;

-- ---------- Create from template (SUB-1) -----------------------------
create or replace function public.create_subscription_from_template(
  p_template_id uuid, p_customer_id uuid, p_start date, p_expiry date default null, p_payment_term_id uuid default null)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare t quote_templates; s subscriptions;
begin
  perform public.require_internal();
  select * into t from quote_templates where id = p_template_id and is_active;
  if not found then raise exception 'NOT_FOUND: template' using errcode = 'P0002'; end if;

  insert into subscriptions (customer_id, plan_id, template_id, payment_term_id, start_date, expiry_date, created_by, notes)
  values (p_customer_id, t.plan_id, t.id, p_payment_term_id, p_start, p_expiry, auth.uid(), t.notes)
  returning * into s;

  insert into subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_id, sort_order)
  select s.id, p.id, v.id,
         p.name || coalesce(' (' || v.attribute || ': ' || v.value || ')', ''),
         tl.quantity, p.sales_price + coalesce(v.extra_price, 0), p.default_tax_id, tl.sort_order
    from quote_template_lines tl
    join products p on p.id = tl.product_id
    left join product_variants v on v.id = tl.variant_id
   where tl.template_id = t.id;

  perform public.sub_log(s.id, null, 'draft', 'transition', 'Created from template ' || t.name);
  return s;
end $$;

-- ---------- Replace lines (SUB-2, D-13) ------------------------------
-- p_lines: [{product_id, variant_id?, quantity, unit_price?, tax_id?, description?}]
-- unit_price defaults to product price + variant extra (snapshot, D-5); tax defaults to the product's.
create or replace function public.sub_set_lines(p_id uuid, p_lines jsonb)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare s subscriptions;
begin
  perform public.require_internal();
  select * into s from subscriptions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if s.status not in ('draft', 'quotation', 'active') then
    raise exception 'NOT_EDITABLE: lines can change in Draft, Quotation or Active' using errcode = 'P0001';
  end if;

  delete from subscription_lines where subscription_id = p_id;
  insert into subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_id, sort_order)
  select p_id, p.id, v.id,
         coalesce(nullif(x.description, ''), p.name || coalesce(' (' || v.attribute || ': ' || v.value || ')', '')),
         x.quantity,
         coalesce(x.unit_price, p.sales_price + coalesce(v.extra_price, 0)),
         case when x.tax_id_set then x.tax_id else p.default_tax_id end,
         x.ord - 1
    from jsonb_array_elements(coalesce(p_lines, '[]')) with ordinality as e(j, ord)
    cross join lateral (select (e.j ->> 'product_id')::uuid as product_id,
                               nullif(e.j ->> 'variant_id', '')::uuid as variant_id,
                               (e.j ->> 'quantity')::numeric as quantity,
                               (e.j ->> 'unit_price')::numeric as unit_price,
                               e.j ? 'tax_id' as tax_id_set,
                               nullif(e.j ->> 'tax_id', '')::uuid as tax_id,
                               e.j ->> 'description' as description,
                               e.ord as ord) x
    join products p on p.id = x.product_id
    left join product_variants v on v.id = x.variant_id and v.product_id = p.id;

  if s.status = 'active' then
    perform public.sub_check_min_quantity(p_id);     -- D-13: later changes must still pass D-2
    perform public.sub_log(p_id, s.status, s.status, 'lines', 'Lines changed; applies from the next invoice');
  end if;
  select * into s from subscriptions where id = p_id;
  return s;
end $$;

-- ---------- State machine (SUB-3, D-7) -------------------------------
create or replace function public.sub_transition(p_id uuid, p_to subscription_status, p_note text default null)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare
  x record;
  v_days int;
begin
  select * into x from public.sub_load(p_id);
  if not x.internal then raise exception 'FORBIDDEN: staff or admin only' using errcode = '42501'; end if;
  perform public.enter_lifecycle();

  if (x.s).status = 'draft' and p_to = 'quotation' then
    select validity_days into v_days from quote_templates where id = (x.s).template_id;
    v_days := coalesce(v_days, (select (value #>> '{}')::int from app_settings where key = 'default_quote_validity_days'), 30);
    update subscriptions set status = 'quotation', quote_valid_until = public.today_ist() + v_days where id = p_id;

  elsif (x.s).status = 'quotation' and p_to = 'confirmed' then
    if (x.s).quote_valid_until < public.today_ist() then
      raise exception 'QUOTATION_EXPIRED: valid until %', (x.s).quote_valid_until using errcode = 'P0001';
    end if;
    if not exists (select 1 from subscription_lines where subscription_id = p_id) then
      raise exception 'BELOW_MIN_QUANTITY: the subscription has no lines' using errcode = 'P0001';
    end if;
    perform public.sub_check_min_quantity(p_id);
    if not (x.pl).is_active or (x.s).start_date < (x.pl).available_from
       or ((x.pl).available_to is not null and (x.s).start_date > (x.pl).available_to) then
      raise exception 'PLAN_NOT_AVAILABLE: the plan is not available on %', (x.s).start_date using errcode = 'P0001';
    end if;
    update subscriptions set status = 'confirmed' where id = p_id;

  elsif (x.s).status = 'confirmed' and p_to = 'active' then
    update subscriptions set status = 'active', billing_anchor = start_date, periods_billed = 0,
                             next_invoice_date = start_date where id = p_id;

  elsif (x.s).status in ('draft', 'quotation', 'confirmed') and p_to = 'closed' then
    update subscriptions set status = 'closed', close_reason = coalesce(p_note, 'Discarded') where id = p_id;

  elsif (x.s).status = 'active' and p_to = 'closed' then
    return public.sub_close(p_id, p_note);

  else
    raise exception 'INVALID_TRANSITION: % → %', (x.s).status, p_to using errcode = 'P0001';
  end if;

  perform public.sub_log(p_id, (x.s).status, p_to, 'transition', p_note);
  return (select s from subscriptions s where s.id = p_id);
end $$;

-- ---------- Pause / resume / renew / close (D-8, D-9, D-10, CAT-4) ----
create or replace function public.sub_pause(p_id uuid, p_note text default null)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public.sub_load(p_id);
  if (x.s).status <> 'active' or (x.s).is_paused then
    raise exception 'INVALID_TRANSITION: only an active, running subscription can be paused' using errcode = 'P0001';
  end if;
  if not (x.pl).allow_pause then raise exception 'PLAN_NOT_PAUSABLE' using errcode = 'P0001'; end if;
  perform public.enter_lifecycle();
  update subscriptions set is_paused = true, pause_reason = 'manual', paused_on = public.today_ist() where id = p_id;
  perform public.sub_log(p_id, 'active', 'active', 'pause', p_note);
  return (select s from subscriptions s where s.id = p_id);
end $$;

create or replace function public.sub_resume(p_id uuid)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public.sub_load(p_id);
  if not (x.s).is_paused then raise exception 'INVALID_TRANSITION: not paused' using errcode = 'P0001'; end if;
  if (x.s).pause_reason = 'out_of_term' then
    raise exception 'OUT_OF_TERM_RENEW_REQUIRED: renew or close this subscription' using errcode = 'P0001';
  end if;
  perform public.enter_lifecycle();
  -- D-8: billing restarts from the resume date; the paused gap is never billed
  update subscriptions set is_paused = false, pause_reason = null, paused_on = null,
         billing_anchor = public.today_ist(), periods_billed = 0, next_invoice_date = public.today_ist()
   where id = p_id;
  perform public.sub_log(p_id, 'active', 'active', 'resume', null);
  return (select s from subscriptions s where s.id = p_id);
end $$;

create or replace function public.sub_renew(p_id uuid)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare x record; v_new date;
begin
  select * into x from public.sub_load(p_id);
  if (x.s).status <> 'active' then raise exception 'INVALID_TRANSITION: only active subscriptions renew' using errcode = 'P0001'; end if;
  if not (x.pl).allow_renew then raise exception 'PLAN_NOT_RENEWABLE' using errcode = 'P0001'; end if;
  if (x.s).expiry_date is null then raise exception 'INVALID_TRANSITION: no expiry date to extend' using errcode = 'P0001'; end if;
  perform public.enter_lifecycle();
  v_new := public.add_period((x.s).expiry_date, (x.pl).billing_period, 1);
  if (x.s).pause_reason = 'out_of_term' then
    update subscriptions set expiry_date = greatest(v_new, public.add_period(public.today_ist(), (x.pl).billing_period, 1)),
           is_paused = false, pause_reason = null, paused_on = null,
           billing_anchor = public.today_ist(), periods_billed = 0, next_invoice_date = public.today_ist()
     where id = p_id;
  else
    update subscriptions set expiry_date = v_new where id = p_id;
  end if;
  perform public.sub_log(p_id, 'active', 'active', 'renew', 'Expiry extended to ' ||
          (select expiry_date from subscriptions where id = p_id));
  return (select s from subscriptions s where s.id = p_id);
end $$;

create or replace function public.sub_close(p_id uuid, p_reason text default null)
returns subscriptions language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public.sub_load(p_id);
  if (x.s).status <> 'active' then
    if (x.s).status in ('draft', 'quotation', 'confirmed') and x.internal then
      return public.sub_transition(p_id, 'closed', p_reason);
    end if;
    raise exception 'INVALID_TRANSITION: % → closed', (x.s).status using errcode = 'P0001';
  end if;
  -- out-of-term can always be closed (D-9); otherwise the plan must allow early close; admin always
  if not ((x.s).pause_reason = 'out_of_term' or (x.pl).allow_early_close or public.is_admin()) then
    raise exception 'PLAN_NOT_CLOSABLE' using errcode = 'P0001';
  end if;
  perform public.enter_lifecycle();
  update subscriptions set status = 'closed', is_paused = false, pause_reason = null, paused_on = null,
         next_invoice_date = null, close_reason = coalesce(p_reason, 'Closed')
   where id = p_id;
  perform public.sub_log(p_id, 'active', 'closed', 'transition', p_reason);
  return (select s from subscriptions s where s.id = p_id);
end $$;

-- ---------- What the caller may do now (drives every button) ----------
create or replace function public.sub_allowed_actions(p_id uuid) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare s subscriptions; pl plans; internal boolean := public.is_internal(); owner boolean; a text[] := '{}';
begin
  select * into s from subscriptions where id = p_id;
  if not found then return a; end if;
  owner := coalesce(s.customer_id = public.my_customer_id(), false) and s.status <> 'draft';
  if not (internal or owner) then return a; end if;
  select * into pl from plans where id = s.plan_id;
  if internal then
    if s.status = 'draft'     then a := a || array['quotation', 'closed', 'edit']; end if;
    if s.status = 'quotation' then a := a || array['confirmed', 'closed', 'edit']; end if;
    if s.status = 'confirmed' then a := a || array['active', 'closed']; end if;
    if s.status = 'active'    then a := a || array['edit_lines']; end if;
  end if;
  if s.status = 'active' then
    if not s.is_paused and pl.allow_pause then a := array_append(a, 'pause'); end if;
    if s.is_paused and s.pause_reason = 'manual' then a := array_append(a, 'resume'); end if;
    if pl.allow_renew and s.expiry_date is not null then a := array_append(a, 'renew'); end if;
    if s.pause_reason = 'out_of_term' or pl.allow_early_close or public.is_admin() then a := array_append(a, 'close'); end if;
  end if;
  return a;
end $$;

-- ---------- Lifecycle step of the billing run (D-7, D-9) --------------
-- 1. Confirmed with start ≤ as_of → Active (anchor = start date).
-- 2. Expiry reached and nothing left to bill before it → auto-close, or out-of-term pause.
create or replace function public.process_lifecycle(p_as_of date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_as_of date := coalesce(p_as_of, public.today_ist());
  v_activated int; v_closed int; v_out int;
begin
  perform public.require_internal();
  perform public.enter_lifecycle();

  with a as (
    update subscriptions set status = 'active', billing_anchor = start_date, periods_billed = 0, next_invoice_date = start_date
     where status = 'confirmed' and start_date <= v_as_of returning id)
  insert into subscription_status_history (subscription_id, from_status, to_status, event, changed_by)
  select id, 'confirmed', 'active', 'activate', auth.uid() from a;
  get diagnostics v_activated = row_count;

  with c as (
    update subscriptions s set status = 'closed', is_paused = false, pause_reason = null, paused_on = null,
           next_invoice_date = null, close_reason = 'Expired (auto-close)'
      from plans p
     where p.id = s.plan_id and p.auto_close and s.status = 'active'
       and s.expiry_date is not null and s.expiry_date <= v_as_of
       and (s.is_paused or s.next_invoice_date >= s.expiry_date)
    returning s.id)
  insert into subscription_status_history (subscription_id, from_status, to_status, event, changed_by)
  select id, 'active', 'closed', 'auto_close', auth.uid() from c;
  get diagnostics v_closed = row_count;

  with o as (
    update subscriptions s set is_paused = true, pause_reason = 'out_of_term', paused_on = s.expiry_date
      from plans p
     where p.id = s.plan_id and not p.auto_close and s.status = 'active'
       and s.pause_reason is distinct from 'out_of_term'
       and s.expiry_date is not null and s.expiry_date <= v_as_of
       and (s.is_paused or s.next_invoice_date >= s.expiry_date)
    returning s.id)
  insert into subscription_status_history (subscription_id, from_status, to_status, event, note, changed_by)
  select id, 'active', 'active', 'out_of_term', 'Expired, renewal needed', auth.uid() from o;
  get diagnostics v_out = row_count;

  return jsonb_build_object('activated', v_activated, 'auto_closed', v_closed, 'out_of_term', v_out);
end $$;

-- ---------- Function privileges ---------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default. Close that,
-- then grant only what the API calls. Every new function in this file must be listed here.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.sub_log(uuid, subscription_status, subscription_status, text, text),
                           public.sub_check_min_quantity(uuid), public.sub_load(uuid) from authenticated;
grant execute on function
  public.create_subscription_from_template(uuid, uuid, date, date, uuid),
  public.sub_set_lines(uuid, jsonb),
  public.sub_transition(uuid, subscription_status, text),
  public.sub_pause(uuid, text), public.sub_resume(uuid), public.sub_renew(uuid), public.sub_close(uuid, text),
  public.sub_allowed_actions(uuid),
  public.process_lifecycle(date)
to authenticated;
