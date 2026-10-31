-- =====================================================================
-- 0900 Seed helpers (owner: lead). Called by `npm run seed` with the SERVICE ROLE key only.
-- Deterministic (setseed). Scheduler stays off. SPEC §6.
-- =====================================================================

-- Wipe business data (keeps logins/profiles and settings). Used by `npm run seed -- --reset`.
create or replace function public.seed_reset() returns void
language plpgsql security definer set search_path = public as $$
begin
  truncate payments, discount_redemptions, invoice_lines, invoices, billing_runs, email_log,
           subscription_status_history, subscription_lines, subscriptions,
           discount_rule_products, discount_rules, quote_template_lines, quote_templates,
           plans, product_variants, products, payment_terms, taxes restart identity cascade;
  delete from customers where user_id is null;
  alter sequence subscription_number_seq restart; alter sequence invoice_number_seq restart;
end $$;

-- Catalog: taxes, terms, products (+variants), plans, templates, discount rules. Idempotent by name.
create or replace function public.seed_catalog() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t18 uuid; t12 uuid; t5 uuid; d date := public.today_ist();
  crm uuid; helpdesk uuid; odoo uuid; generic uuid; support uuid;
  business uuid; starter uuid; pro uuid;
begin
  insert into taxes (name, rate_percent) values ('GST 18% (demo)', 18), ('GST 12% (demo)', 12), ('GST 5% (demo)', 5)
  on conflict (name) do nothing;
  select id into t18 from taxes where name = 'GST 18% (demo)';
  select id into t12 from taxes where name = 'GST 12% (demo)';
  select id into t5  from taxes where name = 'GST 5% (demo)';
  insert into payment_terms (name, days) values ('Immediate', 0), ('Net 15', 15), ('Net 30', 30) on conflict (name) do nothing;

  if not exists (select 1 from products) then
    insert into products (name, type, sales_price, cost_price, notes, default_tax_id) values
      ('CRM Seat',               'service',  500,  100, 'Per user, per period. Brand variants.', t18),
      ('Helpdesk Seat',          'service',  300,   60, 'Per agent, per period', t18),
      ('Inventory App',          'software', 2000, 400, 'Warehouse and stock module', t18),
      ('Accounting App',         'software', 1500, 300, 'Invoicing and ledgers', t18),
      ('Extra Storage (100 GB)', 'addon',    200,   40, 'Add-on: switch on and off', t18),
      ('Priority Support',       'addon',    1500, 500, 'Add-on: 4-hour response', t5),
      ('Onboarding Session',     'service',  2500, 800, 'Remote onboarding, per session', t18),
      ('Hardware Token',         'other',    800,  350, 'Security key, rented per period', t12);
    select id into crm from products where name = 'CRM Seat';
    insert into product_variants (product_id, attribute, value, extra_price) values
      (crm, 'Brand', 'Odoo', 560), (crm, 'Brand', 'Generic', 0);
  end if;
  select id into crm      from products where name = 'CRM Seat';
  select id into helpdesk from products where name = 'Helpdesk Seat';
  select id into support  from products where name = 'Priority Support';
  select id into odoo     from product_variants where product_id = crm and value = 'Odoo';
  select id into generic  from product_variants where product_id = crm and value = 'Generic';

  if not exists (select 1 from plans) then
    insert into plans (name, price, billing_period, min_quantity, available_from, available_to,
                       auto_close, allow_early_close, allow_pause, allow_renew, tax_id) values
      ('Starter Monthly',    499,  'monthly', 1,  d - 900, null,   false, true,  true,  true,  t18),
      ('Business Monthly',   1000, 'monthly', 5,  d - 900, null,   false, true,  true,  true,  t18),
      ('Pro Yearly',         9999, 'yearly',  10, d - 900, null,   true,  false, false, true,  t18),
      ('Ops Weekly',         199,  'weekly',  1,  d - 900, null,   false, true,  false, true,  t18),
      ('Daily Pass',         49,   'daily',   1,  d - 900, null,   true,  true,  false, false, t18),
      ('Fixed Term Monthly', 799,  'monthly', 1,  d - 900, null,   false, false, false, true,  t18),
      ('Legacy Monthly',     399,  'monthly', 1,  d - 900, d + 10, true,  true,  true,  false, t18);
  end if;
  select id into business from plans where name = 'Business Monthly';
  select id into starter  from plans where name = 'Starter Monthly';
  select id into pro      from plans where name = 'Pro Yearly';

  if not exists (select 1 from quote_templates) then
    with t as (insert into quote_templates (name, plan_id, validity_days, notes) values
                 ('Business · 12 Odoo CRM seats', business, 15, 'Includes one onboarding call') returning id)
    insert into quote_template_lines (template_id, product_id, variant_id, quantity) select id, crm, odoo, 12 from t;
    with t as (insert into quote_templates (name, plan_id, validity_days) values
                 ('Starter · 1 Helpdesk seat', starter, 30) returning id)
    insert into quote_template_lines (template_id, product_id, quantity) select id, helpdesk, 1 from t;
    with t as (insert into quote_templates (name, plan_id, validity_days) values
                 ('Pro · 10 CRM seats + support', pro, 20) returning id)
    insert into quote_template_lines (template_id, product_id, variant_id, quantity, sort_order)
    select id, crm, generic, 10, 0 from t union all select id, support, null, 1, 1 from t;
  end if;

  if not exists (select 1 from discount_rules) then
    insert into discount_rules (name, kind, value, scope, condition, condition_value, starts_on, ends_on, usage_limit) values
      ('10% from 10 seats',           'percent', 10,  'products',     'min_quantity', 10,    d - 900, null,   null),
      ('₹500 off orders from ₹5,000', 'fixed',   500, 'subscription', 'min_purchase', 5000,  d - 900, null,   null),
      ('Launch 15% (3 uses)',         'percent', 15,  'products',     'none',         null,  d,       null,   3),
      ('Festive 5% (ends soon)',      'percent', 5,   'subscription', 'min_purchase', 20000, d - 30,  d + 3,  null);
    insert into discount_rule_products (rule_id, product_id)
    select id, crm from discount_rules where name = '10% from 10 seats'
    union all select id, helpdesk from discount_rules where name = 'Launch 15% (3 uses)';
  end if;

  return jsonb_build_object('taxes', (select count(*) from taxes), 'products', (select count(*) from products),
                            'plans', (select count(*) from plans), 'templates', (select count(*) from quote_templates),
                            'discount_rules', (select count(*) from discount_rules));
end $$;

-- Customers + subscriptions in every state. p_aligned subscriptions get a period starting today.
create or replace function public.seed_subscriptions(p_customers int default 1500, p_subs int default 5000, p_aligned int default 220)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d date := public.today_ist(); v_first int;
begin
  perform setseed(0.42);
  perform public.enter_lifecycle();
  if exists (select 1 from subscriptions) then
    return jsonb_build_object('skipped', 'subscriptions already exist; run with --reset to rebuild');
  end if;

  insert into customers (name, company_name, email, phone, address, gstin)
  select f || ' ' || l, l || ' ' || (array['Traders','Retail','Tech','Foods','Logistics','Studio','Pharma','Textiles'])[1 + (g % 8)],
         'customer' || g || '@example.test', '+91 9' || lpad((g * 7919 % 1000000000)::text, 9, '0'),
         (array['Kochi','Thrissur','Kottayam','Bengaluru','Chennai','Pune','Mumbai','Hyderabad'])[1 + (g % 8)] || ', India',
         case when g % 3 = 0 then '32ABCDE' || lpad(g::text, 4, '0') || 'F1Z5' end
    from generate_series(1, p_customers) g,
         lateral (select (array['Anu','Arjun','Meera','Rahul','Divya','Kiran','Nisha','Vivek','Fathima','Joseph','Lakshmi','Rohan'])[1 + (g % 12)] as f,
                         (array['Menon','Nair','Pillai','Varghese','Iyer','Rao','Thomas','Khan','Das','George'])[1 + ((g / 12) % 10)] as l) n
  on conflict (email) do nothing;

  -- Plan mix and states
  create temp table _c on commit drop as
  select id, (row_number() over (order by email) - 1)::int as rn from customers;
  select count(*) into v_first from _c;
  create temp table _s on commit drop as
  select g,
         (select id from _c where rn = g % v_first) as customer_id,
         case when g <= p_aligned then (array['Business Monthly','Starter Monthly','Ops Weekly'])[1 + g % 3]
              else (array['Starter Monthly','Starter Monthly','Business Monthly','Business Monthly','Business Monthly',
                          'Pro Yearly','Ops Weekly','Fixed Term Monthly','Legacy Monthly','Starter Monthly'])[1 + g % 10] end as plan_name,
         case when g <= p_aligned          then 'aligned'
              when g <= p_subs * 0.70      then 'active'
              when g <= p_subs * 0.74      then 'out_of_term'
              when g <= p_subs * 0.78      then 'expiring'
              when g <= p_subs * 0.84      then 'draft'
              when g <= p_subs * 0.90      then 'quotation'
              when g <= p_subs * 0.94      then 'confirmed'
              else 'discarded' end as kind,
         random() as r1, random() as r2
    from generate_series(1, p_subs) g;
  -- a handful of daily subscriptions (they create one invoice per day)
  update _s set plan_name = 'Daily Pass' where kind = 'active' and g % 97 = 0;
  -- out-of-term needs a plan without auto-close; auto-closing ones use Pro Yearly
  update _s set plan_name = 'Fixed Term Monthly' where kind = 'out_of_term';

  insert into subscriptions (customer_id, plan_id, payment_term_id, status, start_date, expiry_date, quote_valid_until,
                             billing_anchor, periods_billed, next_invoice_date, close_reason, created_at)
  select x.customer_id, p.id,
         (array(select id from payment_terms order by days))[1 + x.g % 3],
         case x.kind when 'aligned' then 'active' when 'active' then 'active' when 'out_of_term' then 'active'
                     when 'expiring' then 'active' when 'draft' then 'draft' when 'quotation' then 'quotation'
                     when 'confirmed' then 'confirmed' else 'closed' end::subscription_status,
         st.start_date,
         case when x.kind = 'out_of_term' then st.start_date + 60 + (x.r2 * 30)::int
              when x.kind = 'expiring'    then d + 1 + (x.r2 * 25)::int
              when p.billing_period = 'yearly' then (st.start_date + interval '2 years')::date
              when x.g % 4 = 0 then (st.start_date + interval '1 year')::date
              else null end,
         case when x.kind = 'quotation' then d + 15 - (case when x.g % 3 = 0 then 30 else 0 end) end,
         case when x.kind in ('aligned','active','out_of_term','expiring') then st.start_date end,
         0,
         case when x.kind in ('aligned','active','out_of_term','expiring') then st.start_date end,
         case when x.kind = 'discarded' then 'Customer declined' end,
         now() - make_interval(days => (x.r1 * 300)::int)
    from _s x
    join plans p on p.name = x.plan_name
    cross join lateral (select case
        when x.kind = 'aligned' and p.billing_period = 'weekly' then d - 7 * (1 + (x.g % 8))
        when x.kind = 'aligned' then coalesce(
              (select (d - make_interval(months => k))::date from generate_series(1, 18) k
                where public.add_period((d - make_interval(months => k))::date, 'monthly', k) = d
                offset (x.g % 4) limit 1), d - 7)
        when x.kind in ('draft','quotation','confirmed') then d + 1 + (x.r1 * 20)::int
        when x.kind = 'out_of_term' then d - 150 + (x.r1 * 40)::int
        when p.billing_period = 'daily' then d - 1 - (x.r1 * 25)::int
        when p.billing_period = 'weekly' then d - 1 - (x.r1 * 120)::int
        when p.billing_period = 'yearly' then d - 1 - (x.r1 * 600)::int
        else d - 1 - (x.r1 * 330)::int end as start_date) st;

  -- Lines: main product ≥ plan minimum, sometimes an add-on (unit price = product + variant, tax = product default)
  insert into subscription_lines (subscription_id, product_id, variant_id, description, quantity, unit_price, tax_id, sort_order)
  select s.id, pr.id, v.id, pr.name || coalesce(' (Brand: ' || v.value || ')', ''),
         greatest(pl.min_quantity, 1 + (abs(hashtext(s.id::text)) % 15)), pr.sales_price + coalesce(v.extra_price, 0), pr.default_tax_id, 0
    from subscriptions s join plans pl on pl.id = s.plan_id
    join products pr on pr.name = (array['CRM Seat','Helpdesk Seat','Inventory App','Accounting App','Hardware Token'])[1 + abs(hashtext(s.number)) % 5]
    left join product_variants v on v.product_id = pr.id and v.value = case when abs(hashtext(s.number)) % 2 = 0 then 'Odoo' else 'Generic' end;
  insert into subscription_lines (subscription_id, product_id, description, quantity, unit_price, tax_id, sort_order)
  select s.id, pr.id, pr.name, 1, pr.sales_price, pr.default_tax_id, 1
    from subscriptions s
    join products pr on pr.name = case when abs(hashtext(s.id::text)) % 2 = 0 then 'Extra Storage (100 GB)' else 'Priority Support' end
   where abs(hashtext(s.number || 'addon')) % 4 = 0;

  -- the demo customer login gets a few subscriptions of its own (2 running, 1 quotation, 1 draft)
  update subscriptions set customer_id = (select id from customers where email = 'shop@corner.test')
   where exists (select 1 from customers where email = 'shop@corner.test')
     and id in ((select id from subscriptions where status = 'active' and expiry_date is null order by number limit 2)
                union all (select id from subscriptions where status = 'quotation' order by number limit 1)
                union all (select id from subscriptions where status = 'draft' order by number limit 1));

  insert into subscription_status_history (subscription_id, from_status, to_status, event, note, changed_at)
  select id, null, status, 'transition', 'Seeded', created_at from subscriptions;

  return jsonb_build_object('customers', (select count(*) from customers), 'subscriptions', (select count(*) from subscriptions));
end $$;

-- History billing: one week at a time, due dates as if generated on that day.
create or replace function public.seed_bill_until(p_as_of date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r billing_runs;
begin
  r := public.run_billing_core(p_as_of, 'scheduled', p_as_of);
  analyze subscriptions; analyze invoices; analyze invoice_lines; analyze discount_rules;
  return jsonb_build_object('as_of', p_as_of, 'created', r.created_count, 'failed', r.failed_count);
end $$;

-- After history billing: confirm older invoices, pay most, pause some, cancel a few.
create or replace function public.seed_finish(p_paid_ratio numeric default 0.8) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := public.today_ist();
begin
  perform setseed(0.24);
  perform public.enter_lifecycle();

  -- a few cancelled drafts (no payments) so the Cancelled tab is not empty
  with c as (select id from invoices where status = 'draft' and discount_rule_id is null and invoice_date < d - 3
              order by number limit 25)
  update invoices set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Seeded: duplicate request' where id in (select id from c);

  update invoices set status = 'confirmed', confirmed_at = (invoice_date + 1)::timestamptz
   where status = 'draft' and invoice_date < d - 3;
  update invoices set status = 'paid', paid_at = confirmed_at where status = 'confirmed' and total = 0;
  update discount_redemptions r set state = 'committed' from invoices i where i.id = r.invoice_id and i.status in ('confirmed', 'paid');

  create temp table _p on commit drop as
  select i.id, i.customer_id, i.total, i.invoice_date, i.due_date, random() as r, random() as r2
    from invoices i where i.status = 'confirmed' and i.total > 0;
  analyze _p;

  -- fully paid
  insert into payments (invoice_id, customer_id, method, amount, paid_on, note)
  select id, customer_id, (array['bank_transfer','upi','card','cash','cheque'])[1 + floor(r2 * 5)::int]::payment_method, total,
         least(d - 1, invoice_date + (r2 * 20)::int), 'Seeded payment'
    from _p where r < p_paid_ratio;
  -- partially paid: two instalments are not needed, one partial payment is enough
  insert into payments (invoice_id, customer_id, method, amount, paid_on, note)
  select id, customer_id, 'upi', round(total * 0.4, 2), least(d - 1, invoice_date + 5), 'Seeded part payment'
    from _p where r >= p_paid_ratio and r < p_paid_ratio + 0.07;

  update invoices i set amount_paid = x.paid,
         status = case when x.paid = i.total then 'paid'::invoice_status else i.status end,
         paid_at = case when x.paid = i.total then x.last::timestamptz end
    from (select invoice_id, sum(amount) as paid, max(paid_on) as last from payments group by invoice_id) x
   where x.invoice_id = i.id;

  -- manual pauses on plans that allow it
  with p as (
    update subscriptions s set is_paused = true, pause_reason = 'manual', paused_on = d - (abs(hashtext(s.id::text)) % 20)
      from plans pl
     where pl.id = s.plan_id and pl.allow_pause and s.status = 'active' and not s.is_paused
       and s.next_invoice_date > d and abs(hashtext(s.number || 'pause')) % 14 = 0
    returning s.id)
  insert into subscription_status_history (subscription_id, from_status, to_status, event, note)
  select id, 'active', 'active', 'pause', 'Seeded pause' from p;

  analyze;
  return jsonb_build_object(
    'invoices', (select count(*) from invoices), 'payments', (select count(*) from payments),
    'due_today', (select count(*) from subscriptions where status = 'active' and not is_paused and next_invoice_date <= d
                    and (expiry_date is null or next_invoice_date < expiry_date)),
    'paused', (select count(*) from subscriptions where pause_reason = 'manual'),
    'out_of_term', (select count(*) from subscriptions where pause_reason = 'out_of_term'));
end $$;

-- ---------- Function privileges ---------------------------------------
-- Supabase grants EXECUTE on new functions to anon and authenticated by default. Close that,
-- then grant only what the API calls. Every new function in this file must be listed here.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.seed_reset(), public.seed_catalog(), public.seed_subscriptions(int, int, int),
                           public.seed_bill_until(date), public.seed_finish(numeric)
  from public, anon, authenticated;
grant execute on function public.seed_reset(), public.seed_catalog(), public.seed_subscriptions(int, int, int),
                          public.seed_bill_until(date), public.seed_finish(numeric)
  to service_role;
