-- =====================================================================
-- 0001 Core schema (owner: lead). Tables, enums, constraints, indexes.
-- SPEC.md §2 · context.md D-1…D-29. Additive changes only after this point.
-- =====================================================================
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------- Enums ----------------------------------------------------
create type user_role           as enum ('admin', 'staff', 'customer');
create type product_type        as enum ('service', 'software', 'addon', 'other');
create type billing_period      as enum ('daily', 'weekly', 'monthly', 'yearly');
create type subscription_status as enum ('draft', 'quotation', 'confirmed', 'active', 'closed');
create type pause_reason        as enum ('manual', 'out_of_term');
create type invoice_status      as enum ('draft', 'confirmed', 'paid', 'cancelled');
create type invoice_line_kind   as enum ('plan_fee', 'product');
create type discount_kind       as enum ('percent', 'fixed');
create type discount_scope      as enum ('products', 'subscription');
create type discount_condition  as enum ('none', 'min_purchase', 'min_quantity');
create type redemption_state    as enum ('reserved', 'committed', 'released');
create type payment_method      as enum ('cash', 'bank_transfer', 'card', 'upi', 'cheque');
create type billing_trigger     as enum ('manual', 'scheduled');
create type email_status        as enum ('sent', 'failed', 'skipped');

create sequence subscription_number_seq;
create sequence invoice_number_seq;

-- ---------- Identity -------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      citext not null unique,
  full_name  text not null default '',
  role       user_role not null default 'customer',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table customers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references profiles (id) on delete set null,
  name         text not null check (length(trim(name)) > 0),
  company_name text,
  email        citext not null unique,
  phone        text,
  address      text,
  gstin        text,
  created_by   uuid references profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- Configuration --------------------------------------------
create table taxes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  rate_percent numeric(5,2) not null check (rate_percent between 0 and 100),
  is_active    boolean not null default true
);

create table payment_terms (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  days      int not null check (days >= 0),
  is_active boolean not null default true
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  type           product_type not null default 'service',
  sales_price    numeric(12,2) not null check (sales_price >= 0),
  cost_price     numeric(12,2) not null default 0 check (cost_price >= 0),
  notes          text,
  default_tax_id uuid references taxes (id),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  attribute   text not null,
  value       text not null,
  extra_price numeric(12,2) not null default 0 check (extra_price >= 0),
  unique (product_id, attribute, value)
);

create table plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (length(trim(name)) > 0),
  price             numeric(12,2) not null check (price >= 0),
  billing_period    billing_period not null,
  min_quantity      int not null default 1 check (min_quantity >= 1),
  available_from    date not null default current_date,
  available_to      date,
  auto_close        boolean not null default false,
  allow_early_close boolean not null default true,
  allow_pause       boolean not null default false,
  allow_renew       boolean not null default true,
  tax_id            uuid references taxes (id),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  check (available_to is null or available_to >= available_from)
);

create table quote_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  plan_id       uuid not null references plans (id),
  validity_days int not null check (validity_days > 0),
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table quote_template_lines (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references quote_templates (id) on delete cascade,
  product_id  uuid not null references products (id),
  variant_id  uuid references product_variants (id),
  quantity    numeric(12,2) not null check (quantity > 0),
  sort_order  int not null default 0
);

create table discount_rules (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  kind            discount_kind not null,
  value           numeric(12,2) not null check (value > 0),
  scope           discount_scope not null,
  condition       discount_condition not null default 'none',
  condition_value numeric(12,2),
  starts_on       date not null default current_date,
  ends_on         date,
  usage_limit     int check (usage_limit is null or usage_limit > 0),
  used_count      int not null default 0,
  is_active       boolean not null default true,
  created_by      uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100),
  check ((condition = 'none') = (condition_value is null)),
  check (condition_value is null or condition_value > 0),
  check (ends_on is null or ends_on >= starts_on),
  check (used_count >= 0 and (usage_limit is null or used_count <= usage_limit))
);

create table discount_rule_products (
  rule_id    uuid not null references discount_rules (id) on delete cascade,
  product_id uuid not null references products (id),
  primary key (rule_id, product_id)
);

create table app_settings (
  key   text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values
  ('default_quote_validity_days', '30'),
  ('scheduler_enabled', 'false');

-- ---------- Subscriptions --------------------------------------------
create table subscriptions (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique default 'SUB-' || lpad(nextval('subscription_number_seq')::text, 6, '0'),
  customer_id       uuid not null references customers (id),
  plan_id           uuid not null references plans (id),
  template_id       uuid references quote_templates (id),
  payment_term_id   uuid references payment_terms (id),
  status            subscription_status not null default 'draft',
  start_date        date not null,
  expiry_date       date,
  quote_valid_until date,
  is_paused         boolean not null default false,
  pause_reason      pause_reason,
  paused_on         date,
  billing_anchor    date,              -- period n starts at add_period(billing_anchor, period, n)
  periods_billed    int not null default 0,   -- periods since billing_anchor already invoiced
  next_invoice_date date,
  close_reason      text,
  notes             text,
  created_by        uuid references profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (expiry_date is null or expiry_date > start_date),
  check (is_paused = (pause_reason is not null)),
  check (not is_paused or status = 'active')
);

create table subscription_lines (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  product_id      uuid not null references products (id),
  variant_id      uuid references product_variants (id),
  description     text not null,
  quantity        numeric(12,2) not null check (quantity > 0),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  tax_id          uuid references taxes (id),
  sort_order      int not null default 0
);

create table subscription_status_history (
  id              bigint generated always as identity primary key,
  subscription_id uuid not null references subscriptions (id) on delete cascade,
  from_status     subscription_status,
  to_status       subscription_status not null,
  event           text not null check (event in ('transition', 'pause', 'resume', 'renew', 'out_of_term', 'auto_close', 'activate', 'lines')),
  note            text,
  changed_by      uuid references profiles (id) on delete set null,
  changed_at      timestamptz not null default now()
);

-- ---------- Billing --------------------------------------------------
create table billing_runs (
  id            bigint generated always as identity primary key,
  as_of         date not null,
  trigger       billing_trigger not null,
  triggered_by  uuid references profiles (id) on delete set null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  created_count int not null default 0,
  skipped_count int not null default 0,
  failed_count  int not null default 0,
  failures      jsonb not null default '[]'
);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  number            text not null unique default 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0'),
  subscription_id   uuid not null references subscriptions (id),
  customer_id       uuid not null references customers (id),
  billing_run_id    bigint references billing_runs (id),
  period_start      date not null,
  period_end        date not null,
  invoice_date      date not null,
  due_date          date not null,
  status            invoice_status not null default 'draft',
  customer_snapshot jsonb not null default '{}',
  payment_term_name text,
  payment_term_days int,
  subtotal          numeric(12,2) not null default 0,
  discount_total    numeric(12,2) not null default 0,
  tax_total         numeric(12,2) not null default 0,
  total             numeric(12,2) not null default 0,
  amount_paid       numeric(12,2) not null default 0,
  amount_due        numeric(12,2) generated always as (total - amount_paid) stored,
  discount_rule_id  uuid references discount_rules (id),
  discount_name     text,
  confirmed_at      timestamptz,
  sent_at           timestamptz,
  paid_at           timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  check (amount_paid >= 0 and amount_paid <= total),
  check (period_end >= period_start)
);
-- BILL-4 / D-17: one live invoice per subscription period
create unique index invoices_one_per_period on invoices (subscription_id, period_start) where status <> 'cancelled';

create table invoice_lines (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid not null references invoices (id) on delete cascade,
  kind            invoice_line_kind not null,
  product_id      uuid references products (id),
  variant_id      uuid references product_variants (id),
  description     text not null,
  quantity        numeric(12,2) not null,
  unit_price      numeric(12,2) not null,
  amount          numeric(12,2) not null,
  discount_amount numeric(12,2) not null default 0,
  tax_name        text,
  tax_rate        numeric(5,2) not null default 0,
  tax_amount      numeric(12,2) not null default 0,
  total           numeric(12,2) not null,
  sort_order      int not null default 0
);

create table discount_redemptions (
  id         uuid primary key default gen_random_uuid(),
  rule_id    uuid not null references discount_rules (id),
  invoice_id uuid not null references invoices (id) on delete cascade,
  amount     numeric(12,2) not null,
  state      redemption_state not null default 'reserved',
  created_at timestamptz not null default now(),
  unique (rule_id, invoice_id)
);

-- ---------- Finance and email ----------------------------------------
create table payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references invoices (id),
  customer_id uuid not null references customers (id),
  method      payment_method not null,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null,
  note        text,
  recorded_by uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table email_log (
  id         bigint generated always as identity primary key,
  to_email   text not null,
  subject    text not null,
  kind       text not null,
  related_id uuid,
  status     email_status not null,
  error      text,
  created_at timestamptz not null default now()
);

-- ---------- Indexes (NFR-1) ------------------------------------------
create index subscriptions_status_next_idx on subscriptions (status, next_invoice_date);
create index subscriptions_customer_idx    on subscriptions (customer_id);
create index subscriptions_plan_idx        on subscriptions (plan_id);
create index subscriptions_expiry_idx      on subscriptions (expiry_date);
create index subscriptions_created_idx     on subscriptions (created_at desc);
create index subscription_lines_sub_idx    on subscription_lines (subscription_id);
create index status_history_sub_idx        on subscription_status_history (subscription_id, changed_at);
create index invoices_status_due_idx       on invoices (status, due_date);
create index invoices_customer_idx         on invoices (customer_id);
create index invoices_subscription_idx     on invoices (subscription_id);
create index invoices_date_idx             on invoices (invoice_date);
create index invoices_created_idx          on invoices (created_at desc);
create index invoice_lines_invoice_idx     on invoice_lines (invoice_id);
create index payments_invoice_idx          on payments (invoice_id);
create index payments_paid_on_idx          on payments (paid_on);
create index payments_customer_idx         on payments (customer_id);
create index discount_rules_active_idx     on discount_rules (is_active, starts_on, ends_on);
create index customers_name_trgm_idx       on customers using gin (name gin_trgm_ops);
create index customers_email_trgm_idx      on customers using gin ((email::text) gin_trgm_ops);
create index products_name_trgm_idx        on products using gin (name gin_trgm_ops);
