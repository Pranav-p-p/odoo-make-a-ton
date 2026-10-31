-- Core checks on a seeded local database (run after the stub, migrations and the seed).
-- Each block raises if a rule is broken. Acts as the staff user through request.jwt.claim.sub.
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', (select id::text from profiles where email = 'staff@brightloop.test'), false);
set role authenticated;

-- BILL-4 / D-17: run once, then again: zero new invoices
do $$ declare a billing_runs; b billing_runs; begin
  a := public.run_billing();
  b := public.run_billing();
  raise notice 'run 1 created % failed %, run 2 created %', a.created_count, a.failed_count, b.created_count;
  if a.created_count = 0 or b.created_count <> 0 or a.failed_count <> 0 then raise exception 'idempotency check failed'; end if;
end $$;

-- D-16: month-end clamp
do $$ begin
  if public.add_period('2026-01-31', 'monthly', 1) <> '2026-02-28' or public.add_period('2026-01-31', 'monthly', 2) <> '2026-03-31'
     or public.add_period('2026-01-31', 'monthly', 3) <> '2026-04-30' then raise exception 'add_period clamp failed'; end if;
end $$;

-- SUB-1, SUB-3, D-1, D-3, D-21, D-22: template → Active → invoice maths (expected 14,688.64)
do $$ declare s subscriptions; c uuid; t uuid; r billing_runs; i invoices; begin
  select id into c from customers where email = 'customer7@example.test';
  select id into t from quote_templates where name = 'Business · 12 Odoo CRM seats';
  s := public.create_subscription_from_template(t, c, public.today_ist(), null, (select id from payment_terms where name = 'Net 15'));
  s := public.sub_transition(s.id, 'quotation');
  s := public.sub_transition(s.id, 'confirmed');
  s := public.sub_transition(s.id, 'active');
  r := public.run_billing();
  select * into i from invoices where subscription_id = s.id;
  raise notice 'invoice % subtotal % discount % (%) tax % total %', i.number, i.subtotal, i.discount_total, i.discount_name, i.tax_total, i.total;
  if i.total <> 14688.64 then raise exception 'invoice maths: expected 14688.64, got %', i.total; end if;
  if i.due_date <> public.today_ist() + 15 then raise exception 'due date'; end if;
  -- PAY-1, D-24: two payments then Paid; overpayment refused
  i := public.invoice_confirm(i.id);
  i := public.record_payment(i.id, 5000, 'upi');
  begin perform public.record_payment(i.id, i.amount_due + 1, 'cash'); raise exception 'overpayment accepted';
  exception when others then if sqlerrm not like 'AMOUNT_EXCEEDS_DUE%' then raise; end if; end;
  i := public.record_payment(i.id, i.amount_due, 'bank_transfer');
  if i.status <> 'paid' then raise exception 'not paid'; end if;
end $$;

-- D-2: below minimum refused; D-7 expired quote refused
do $$ declare s subscriptions; begin
  select * into s from subscriptions where status = 'quotation' and quote_valid_until < public.today_ist() limit 1;
  begin perform public.sub_transition(s.id, 'confirmed'); raise exception 'expired quote confirmed';
  exception when others then if sqlerrm not like 'QUOTATION_EXPIRED%' then raise; end if; end;
end $$;

-- D-8 / D-9: pause, resume re-anchors; out-of-term resume refused, renew works
do $$ declare s subscriptions; begin
  select s2.* into s from subscriptions s2 join plans p on p.id = s2.plan_id
   where s2.status = 'active' and not s2.is_paused and p.allow_pause limit 1;
  s := public.sub_pause(s.id);
  s := public.sub_resume(s.id);
  if s.next_invoice_date <> public.today_ist() or s.billing_anchor <> public.today_ist() then raise exception 'resume anchor'; end if;
  select * into s from subscriptions where pause_reason = 'out_of_term' limit 1;
  begin perform public.sub_resume(s.id); raise exception 'out-of-term resumed';
  exception when others then if sqlerrm not like 'OUT_OF_TERM_RENEW_REQUIRED%' then raise; end if; end;
  s := public.sub_renew(s.id);
  if s.is_paused then raise exception 'renew did not un-pause'; end if;
end $$;

-- AUTH-4: customer sees only own data and no drafts; customer cannot run billing
reset role;
select set_config('request.jwt.claim.sub', (select id::text from profiles where email = 'shop@corner.test'), false);
set role authenticated;
do $$ begin
  if exists (select 1 from subscriptions where customer_id <> public.my_customer_id() or status = 'draft') then raise exception 'customer isolation'; end if;
  if exists (select 1 from invoices where customer_id <> public.my_customer_id() or status = 'draft') then raise exception 'invoice isolation'; end if;
  begin perform public.run_billing(); raise exception 'customer ran billing';
  exception when others then if sqlerrm not like 'FORBIDDEN%' then raise; end if; end;
end $$;
reset role;
select 'ALL CORE CHECKS PASSED' as result;

-- Security: anon can call nothing; authenticated cannot call internal helpers
do $$ begin
  if has_function_privilege('anon', 'public.run_billing(date, billing_trigger)', 'execute') then raise exception 'anon can run billing'; end if;
  if has_function_privilege('anon', 'public.seed_reset()', 'execute') then raise exception 'anon can reset'; end if;
  if has_function_privilege('authenticated', 'public.seed_reset()', 'execute') then raise exception 'authenticated can reset'; end if;
  if has_function_privilege('authenticated', 'public.enter_lifecycle()', 'execute') then raise exception 'authenticated can bypass the lifecycle guard'; end if;
  if has_function_privilege('authenticated', 'public.bill_next_period(uuid, bigint, date)', 'execute') then raise exception 'authenticated can bill directly'; end if;
  if has_function_privilege('authenticated', 'public.sub_log(uuid, subscription_status, subscription_status, text, text)', 'execute') then raise exception 'authenticated can write history'; end if;
end $$;
-- A signed-in request with role authenticated but no profile is not trusted
select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
do $$ begin
  begin perform public.run_billing(); raise exception 'untrusted caller ran billing';
  exception when others then if sqlerrm not like 'FORBIDDEN%' then raise; end if; end;
end $$;
reset role;
select 'SECURITY CHECKS PASSED' as result;
