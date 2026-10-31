-- =====================================================================
-- 0003 Core read views (owner: lead). security_invoker = RLS of the caller applies.
-- Derived values are computed here, never stored (D-14).
-- =====================================================================

create or replace view subscription_list with (security_invoker = true) as
select s.id, s.number, s.status, s.is_paused, s.pause_reason, s.start_date, s.expiry_date,
       s.quote_valid_until, s.next_invoice_date, s.created_at,
       s.customer_id, c.name as customer_name, c.company_name,
       s.plan_id, p.name as plan_name, p.billing_period, p.price as plan_price,
       p.price + coalesce(l.lines_total, 0)                                         as recurring_amount,
       round((p.price + coalesce(l.lines_total, 0)) * public.monthly_factor(p.billing_period), 2) as mrr,
       (s.status = 'quotation' and s.quote_valid_until < public.today_ist())        as quote_expired,
       case when s.expiry_date is not null then s.expiry_date - public.today_ist() end as days_to_expiry,
       (s.is_paused and s.pause_reason = 'out_of_term')                              as is_out_of_term
  from subscriptions s
  join customers c on c.id = s.customer_id
  join plans p     on p.id = s.plan_id
  left join lateral (select sum(round(quantity * unit_price, 2)) as lines_total
                       from subscription_lines where subscription_id = s.id) l on true;

create or replace view invoice_list with (security_invoker = true) as
select i.id, i.number, i.status, i.invoice_date, i.due_date, i.period_start, i.period_end,
       i.subtotal, i.discount_total, i.tax_total, i.total, i.amount_paid, i.amount_due,
       i.created_at, i.sent_at, i.billing_run_id,
       i.customer_id, c.name as customer_name,
       i.subscription_id, s.number as subscription_number, s.plan_id,
       (i.status = 'confirmed' and i.amount_due > 0 and i.due_date < public.today_ist())   as is_overdue,
       case when i.status = 'confirmed' and i.amount_due > 0 and i.due_date < public.today_ist()
            then public.today_ist() - i.due_date else 0 end                                as days_overdue,
       case when i.status = 'paid' or (i.total > 0 and i.amount_paid >= i.total) then 'paid'
            when i.amount_paid > 0 then 'partially_paid' else 'unpaid' end                 as payment_state
  from invoices i
  join customers c     on c.id = i.customer_id
  join subscriptions s on s.id = i.subscription_id;

grant select on subscription_list, invoice_list to authenticated;
