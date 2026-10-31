-- =====================================================================
-- 0002 Core security (owner: lead): helpers, profile trigger, lifecycle guard, RLS, grants.
-- AUTH-4, D-26, D-27, D-29 · context.md §5
-- =====================================================================

-- ---------- Date helpers (D-29, D-16) --------------------------------
create or replace function public.today_ist() returns date
language sql stable set search_path = public as
$$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- Start of period n counted from the anchor. Calendar-aware: month and year steps clamp to the
-- month end (31 Jan + 1 month = 28/29 Feb, + 2 months = 31 Mar). Never repeated addition.
create or replace function public.add_period(p_anchor date, p_period billing_period, p_n int) returns date
language sql immutable set search_path = public as $$
  select case p_period
    when 'daily'   then p_anchor + p_n
    when 'weekly'  then p_anchor + 7 * p_n
    when 'monthly' then (p_anchor + make_interval(months => p_n))::date
    when 'yearly'  then (p_anchor + make_interval(years => p_n))::date
  end
$$;

-- Factor that turns one billing period's amount into a monthly amount (D-25, MRR)
create or replace function public.monthly_factor(p_period billing_period) returns numeric
language sql immutable set search_path = public as $$
  select case p_period when 'daily' then 365.0 / 12 when 'weekly' then 52.0 / 12
                       when 'monthly' then 1.0 when 'yearly' then 1.0 / 12 end
$$;

-- ---------- Role helpers for RLS -------------------------------------
create or replace function public.app_role() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() and is_active $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_role() = 'admin', false) $$;

create or replace function public.is_internal() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.app_role() in ('admin', 'staff'), false) $$;

create or replace function public.my_customer_id() returns uuid
language sql stable security definer set search_path = public as
$$ select id from customers where user_id = auth.uid() $$;

-- Trusted callers without a user: pg_cron / postgres, and the service role (seed script).
-- anon and authenticated JWT requests without a matching staff profile are never trusted.
create or replace function public.is_trusted_system() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is null and coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''),
    'postgres') not in ('anon', 'authenticated')
$$;

-- Raise helpers used by every business function. P0001 + 'CODE: detail' → HTTP 409 (SPEC §3)
create or replace function public.require_internal() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_internal() or public.is_trusted_system()) then
    raise exception 'FORBIDDEN: staff or admin only' using errcode = '42501';
  end if;
end $$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_trusted_system()) then raise exception 'FORBIDDEN: admin only' using errcode = '42501'; end if;
end $$;

-- ---------- Profiles and customers (D-27) ----------------------------
-- A customer login is attached to a customer record (possibly created earlier by staff) only once
-- the email is verified. The role comes only from server-set app_metadata, never from the client.
create or replace function public.attach_customer(p_user uuid, p_name text, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into customers (user_id, name, email) values (p_user, p_name, lower(p_email))
  on conflict (email) do update set user_id = excluded.user_id where customers.user_id is null;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := coalesce(nullif(new.raw_app_meta_data ->> 'role', '')::user_role, 'customer');
  v_name text      := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
begin
  insert into profiles (id, email, full_name, role) values (new.id, lower(new.email), v_name, v_role)
  on conflict (id) do nothing;
  if v_role = 'customer' and new.email_confirmed_at is not null then
    perform public.attach_customer(new.id, v_name, new.email);
  end if;
  return new;
end $$;

create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null
     and not exists (select 1 from customers where user_id = new.id) then
    select full_name into v_name from profiles where id = new.id and role = 'customer';
    if found then perform public.attach_customer(new.id, v_name, new.email); end if;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- Customers may edit their own profile fields but never their email or login link.
create or replace function public.protect_customer_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_internal() then
    if new.email is distinct from old.email or new.user_id is distinct from old.user_id then
      raise exception 'FORBIDDEN: only staff can change email or login link' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger customers_protect before update on customers
  for each row execute function public.protect_customer_columns();

-- ---------- Lifecycle guard (context.md §9.4) -------------------------
-- Status, pause and billing columns change only inside the lifecycle / billing functions, which
-- set app.lifecycle = 'on' for their transaction. Header fields stay editable by staff.
create or replace function public.guard_subscription_lifecycle() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('app.lifecycle', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      if new.status <> 'draft' or new.is_paused or new.billing_anchor is not null or new.next_invoice_date is not null then
        raise exception 'INVALID_TRANSITION: new subscriptions start as Draft' using errcode = 'P0001';
      end if;
    elsif (new.status, new.is_paused, new.pause_reason, new.paused_on, new.billing_anchor, new.periods_billed,
           new.next_invoice_date, new.quote_valid_until, new.close_reason)
          is distinct from
          (old.status, old.is_paused, old.pause_reason, old.paused_on, old.billing_anchor, old.periods_billed,
           old.next_invoice_date, old.quote_valid_until, old.close_reason) then
      raise exception 'INVALID_TRANSITION: use the lifecycle functions to change status' using errcode = 'P0001';
    elsif old.status not in ('draft', 'quotation')
          and (new.customer_id, new.plan_id, new.start_date, new.payment_term_id, new.template_id)
              is distinct from (old.customer_id, old.plan_id, old.start_date, old.payment_term_id, old.template_id) then
      raise exception 'NOT_EDITABLE: header fields can only change in Draft or Quotation' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger subscriptions_guard before insert or update on subscriptions
  for each row execute function public.guard_subscription_lifecycle();

create or replace function public.enter_lifecycle() returns void
language sql set search_path = public as $$ select set_config('app.lifecycle', 'on', true) $$;

-- ---------- Row Level Security ---------------------------------------
alter table profiles                    enable row level security;
alter table customers                   enable row level security;
alter table taxes                       enable row level security;
alter table payment_terms               enable row level security;
alter table products                    enable row level security;
alter table product_variants            enable row level security;
alter table plans                       enable row level security;
alter table quote_templates             enable row level security;
alter table quote_template_lines        enable row level security;
alter table discount_rules              enable row level security;
alter table discount_rule_products      enable row level security;
alter table app_settings                enable row level security;
alter table subscriptions               enable row level security;
alter table subscription_lines          enable row level security;
alter table subscription_status_history enable row level security;
alter table billing_runs                enable row level security;
alter table invoices                    enable row level security;
alter table invoice_lines               enable row level security;
alter table discount_redemptions        enable row level security;
alter table payments                    enable row level security;
alter table email_log                   enable row level security;

-- Identity
create policy profiles_read on profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_internal()));
create policy profiles_admin on profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_self_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = (select public.app_role()));

create policy customers_internal on customers for all to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));
create policy customers_own_read on customers for select to authenticated
  using (user_id = (select auth.uid()));
create policy customers_own_update on customers for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Configuration: products and plans readable by every login; the rest by staff; writes admin
create policy products_read on products for select to authenticated using (true);
create policy products_write on products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy variants_read on product_variants for select to authenticated using (true);
create policy variants_write on product_variants for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plans_read on plans for select to authenticated using (true);
create policy plans_write on plans for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy taxes_read on taxes for select to authenticated using ((select public.is_internal()));
create policy taxes_write on taxes for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy terms_read on payment_terms for select to authenticated using ((select public.is_internal()));
create policy terms_write on payment_terms for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy templates_read on quote_templates for select to authenticated using ((select public.is_internal()));
create policy templates_write on quote_templates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy template_lines_read on quote_template_lines for select to authenticated using ((select public.is_internal()));
create policy template_lines_write on quote_template_lines for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy discounts_read on discount_rules for select to authenticated using ((select public.is_internal()));
create policy discounts_write on discount_rules for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy discount_products_read on discount_rule_products for select to authenticated using ((select public.is_internal()));
create policy discount_products_write on discount_rule_products for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_read on app_settings for select to authenticated using ((select public.is_internal()));
create policy settings_write on app_settings for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Subscriptions: staff all; customers own, never Draft. Lines/history follow the subscription.
create policy subs_internal on subscriptions for all to authenticated
  using ((select public.is_internal())) with check ((select public.is_internal()));
create policy subs_own_read on subscriptions for select to authenticated
  using (customer_id = (select public.my_customer_id()) and status <> 'draft');
create policy sub_lines_read on subscription_lines for select to authenticated
  using (exists (select 1 from subscriptions s where s.id = subscription_id));
create policy sub_history_read on subscription_status_history for select to authenticated
  using (exists (select 1 from subscriptions s where s.id = subscription_id));
-- (no write policies on lines/history: only the lifecycle functions write them)

-- Billing and finance: written only by SQL functions
create policy runs_read on billing_runs for select to authenticated using ((select public.is_internal()));
create policy invoices_internal_read on invoices for select to authenticated using ((select public.is_internal()));
create policy invoices_own_read on invoices for select to authenticated
  using (customer_id = (select public.my_customer_id()) and status <> 'draft');
create policy invoice_lines_read on invoice_lines for select to authenticated
  using (exists (select 1 from invoices i where i.id = invoice_id));
create policy redemptions_read on discount_redemptions for select to authenticated using ((select public.is_internal()));
create policy payments_internal_read on payments for select to authenticated using ((select public.is_internal()));
create policy payments_own_read on payments for select to authenticated
  using (customer_id = (select public.my_customer_id()));
create policy email_log_read on email_log for select to authenticated using ((select public.is_internal()));

-- ---------- Grants ---------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- Functions: nobody by default; each slice file grants what the API calls.
revoke execute on all functions in schema public from public, anon;
revoke execute on function public.enter_lifecycle(), public.attach_customer(uuid, text, text), public.handle_new_user(),
                           public.handle_user_confirmed(), public.protect_customer_columns(), public.guard_subscription_lifecycle()
  from authenticated;
grant execute on function public.today_ist(), public.add_period(date, billing_period, int), public.monthly_factor(billing_period),
                          public.app_role(), public.is_admin(), public.is_internal(), public.my_customer_id()
  to authenticated;
alter default privileges in schema public revoke execute on functions from public;
