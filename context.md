# Brightloop Subscription Management System: Agent Context

Make-A-Ton 9.0 (Odoo x CUSAT) virtual round · 31 Oct 2026 · **submission 17:00 IST** · v2.0 · lead: Lakshmidath

## 0. How to use this file

1. This is the shared context for every person and agent on the build. Read it fully, then `docs/SPEC.md`, then your slice in `docs/TASKS.md`.
2. **Order of authority:** (1) the problem statement, verbatim in `docs/problem-statement.md`, which is the source of truth; (2) the decisions in section 3 of this file (labelled D-n), which only fill gaps the statement leaves; (3) `docs/SPEC.md`; (4) `docs/TASKS.md`. A lower item never overrides a higher one.
3. **Do not invent** requirements, states, fields or rules. If something is unclear, stop, add a `QUESTION:` line to `docs/diff.md` and ask the lead. Never build features the statement does not ask for.
4. The judges are Odoo engineers who walk through each scene of the statement and probe edge cases. Every requirement ID in section 2 must be demonstrable.
5. **Owned by the lead** (agents may propose, never merge without review): the database schema and constraints, the billing engine and its idempotency, discount/tax/money math, authorization, and the golden-path test.

## 1. The business in one minute

Brightloop Software sells everything on subscription: business software billed monthly or yearly, add-ons customers switch on and off, and products that come in variants. Customers range from small shops on monthly plans to large companies on yearly contracts.

Today: subscriptions live in a spreadsheet, renewals are remembered by whoever notices, invoices are typed by hand, payments are matched by scrolling bank statements, and revenue reports are built manually each quarter. Result: missed renewals, wrong invoices, and nobody knows how much recurring revenue exists.

We build one platform for the whole life of a subscription: products and plans, quotations, subscriptions, invoices, payments, revenue reporting.

Actors: **Admin** (whole system; sets up products, plans, taxes, discounts, staff), **Staff** (internal team, day-to-day work, limited access), **Customer** (portal; only their own subscriptions and invoices).

## 2. Requirements register (from the statement)

Each line is testable. Cite the ID in tests, commits and PRs.

**AUTH**
- AUTH-1 Customers sign up with email and password. One email belongs to only one account.
- AUTH-2 Password must be MORE than 8 characters (9+) with at least one uppercase, one lowercase and one special character. No digit rule. Regex `^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$`. Enforced on client and server.
- AUTH-3 Forgot password: a reset link arrives at the registered email.
- AUTH-4 Three roles: admin (whole system), staff (day-to-day, limited), customer (portal, only own subscriptions and invoices).
- AUTH-5 Only the admin can add a staff member.

**CAT: catalogue**
- CAT-1 Admin adds a product: name, type, sales price, cost price, notes.
- CAT-2 Products come in variants (e.g. by brand); choosing the Odoo brand adds 560 to the price.
- CAT-3 Admin adds a plan: price, billing period (daily, weekly, monthly, yearly), minimum quantity, dates it is available.
- CAT-4 Per plan, the admin decides which apply: closes on its own when it ends, can be closed early, can be paused, can be renewed.
- CAT-5 Admin sets up taxes (rules) and discounts.
- CAT-6 Quotation template: plan and product lines, valid for a set number of days.

**SUB: subscriptions**
- SUB-1 A sales rep starts a quotation from a template instead of from scratch.
- SUB-2 A subscription has its own number, a customer, a plan, start date, expiry date, payment terms, and lines (product, quantity, unit price, taxes, amount).
- SUB-3 Status flow Draft → Quotation → Confirmed → Active → Closed. Anyone on the team can see where it stands.
- PORTAL-1 Customers see and manage their own subscriptions without emailing anyone.

**BILL: invoices**
- BILL-1 Invoices are created from subscriptions with customer details, product lines, taxes and totals filled in. Nobody types invoices by hand.
- BILL-2 Taxes are calculated automatically from rules the admin has set.
- BILL-3 The team can confirm, cancel, send or print any invoice. Status flow Draft → Confirmed → Paid.
- BILL-4 Hundreds of subscriptions can be due at once. Nothing is billed twice or skipped.

**DISC: discounts**
- DISC-1 Only the admin creates discount rules: fixed amount or percentage, a minimum purchase or quantity, start and end dates, a limit on how many times it can be used.
- DISC-2 A discount applies to specific products or to whole subscriptions.
- DISC-3 Once it applies it appears on the next invoice on its own, and stops when it expires or runs out.

**PAY: payments**
- PAY-1 Payments arrive by different methods on different days. Record method, amount, date and a note against the right invoice.
- PAY-2 At any moment the team can see which invoices are paid and which are outstanding, so overdue ones can be chased.

**REP: reporting**
- REP-1 One place for the finance lead: active subscriptions, revenue received, amount still owed, payments, overdue invoices, with filters and a summary view.
- REP-2 The business can say how much recurring revenue it has (from the statement's "How things run today").
- NFR-1 With thousands of subscriptions, every page responds in under two seconds.

## 3. Decisions (only where the statement is silent)

### Stack
- **D-0** Next.js (App Router, TypeScript) + **Supabase**: Postgres, **Supabase Auth**, `pg_cron`. Business rules that touch money or state live in Postgres functions; the Next.js API validates, checks roles and calls them. No ORM. Deployed on Vercel.

### Pricing and money
- **D-1 Plan fee is a separate, visible line.** Invoice = plan fee line (plan price × 1, named after the plan, omitted when 0) + one line per subscription line − discount + tax. Never a charge the customer cannot see.
- **D-2 Minimum quantity** = sum of quantities of the subscription's main product lines (add-on products and the plan fee excluded) must be ≥ the plan's minimum. Checked on Quotation → Confirmed and on every later line change.
- **D-3 Calculation order.** Line amount = quantity × unit price → discount → tax on the discounted amount → totals. Money is `numeric(12,2)`, never float. Round half-up to 2 decimals per line; totals are sums of rounded lines. A discount is spread over its eligible lines in proportion, the rounding remainder on the largest line; a fixed discount never exceeds its eligible base.
- **D-4 Taxes are admin data.** A tax = name + rate %. A product has a default tax; a subscription line can override it; the plan fee uses the plan's optional tax. One tax per line. No rate hardcoded; seed taxes are labelled "(demo)".
- **D-5 History is immutable.** Subscription lines snapshot description and unit price when added. Invoices snapshot customer details, line descriptions, quantities, prices, discount, tax name and rate, payment-term name and days. Later edits never change existing documents. Confirmed invoices are read-only.

### Subscription lifecycle
- **D-6 Exactly five statuses** (SUB-3). Pausing is a flag, `is_paused`, with `pause_reason` = `manual` or `out_of_term`, so the status list stays as the statement says.
- **D-7 Transitions** (server-side only; each writes SubscriptionStatusHistory with who, when, note):
  - Draft → Quotation: sets `quote_valid_until` = today + template validity days (30 when created without a template).
  - Quotation → Confirmed: refused if the quote expired, D-2 fails, or the start date is outside the plan's availability dates.
  - Confirmed → Active: automatically once start date ≤ today (by the lifecycle step of the billing run), or manually. Sets the billing anchor and `next_invoice_date` = start date.
  - Active → Closed: early close only if the plan allows it (admin may always); automatic close at expiry if the plan has auto-close.
  - Draft, Quotation and Confirmed can be closed (discarded) by staff.
- **D-8 Pause and resume.** Manual pause only if the plan allows pausing; staff for any subscription, a customer for their own. While paused nothing is billed. **Resume restarts billing from the resume date**: the resume date becomes the new billing anchor and the next invoice date. No proration; the paused gap is never billed. (Same as Chargebee and Stripe's default.)
- **D-9 Expiry without auto-close: "out of term".** When the expiry date is reached and the plan does not auto-close, the subscription is paused with `pause_reason = out_of_term` and shows "Expired, renewal needed". It is not billed. A plain Resume is refused: the only ways out are **Renew** (if the plan allows renewing) or **Close**. This applies even on plans that do not allow manual pausing. (Same as Zuora's "Out of Term".)
- **D-10 Renew** extends the expiry date by one plan period and is logged. On an out-of-term subscription it also un-pauses it and restarts billing from the renew date (as D-8). Customers may renew their own when the plan allows it.
- **D-11 Plan availability dates** only decide whether a new subscription may start on that plan. They never change existing subscriptions.
- **D-12 Quotations** are subscriptions in Draft/Quotation status, not a separate entity. Staff confirm quotations; customer acceptance in the portal is a nice-to-have.
- **D-13 Add-ons.** Staff can add, change and remove lines on an Active subscription; the change applies from the next invoice (no proration) and must still satisfy D-2. Customer self-service add-on toggles are a nice-to-have.
- **D-14 Derived, never stored:** quote expired, invoice overdue, invoice payment state (unpaid / partially paid / paid). Out of term is stored (D-9) because billing depends on it.

### Billing engine
- **D-15 One billing function, two triggers:** a manual "Run billing" (admin or staff, with an as-of date for demos) and a scheduled `pg_cron` job. Both call the same function and are recorded as BillingRuns with trigger = manual or scheduled.
- **D-16 Billing in advance.** Due = Active, not paused, `next_invoice_date` ≤ as-of date, and the period start is before the expiry date (or there is no expiry). Period n starts at anchor + n × period, calendar-aware with month-end clamping, never by repeated addition. Missed periods are caught up, one invoice per period. Invoice date = period start. **Due date = the date the invoice is generated + payment-term days**, so caught-up invoices are not born overdue.
- **D-17 Idempotency.** Unique `(subscription_id, period_start)` on invoices that are not cancelled; each subscription is billed under its own savepoint with `FOR UPDATE SKIP LOCKED`; a Postgres advisory lock stops two runs overlapping; one failing subscription never aborts the batch. Running twice creates zero new invoices.
- **D-18 BillingRun** records as-of date, trigger, who triggered it, start/end time, created, skipped and failed counts, and failure reasons. The UI shows the summary after every run.
- **D-19 Scheduler** is configurable and stays OFF while seeding and preparing the demo, otherwise it bills the due-today subscriptions before the live demo.
- **D-20 Invoice lifecycle.** Billing creates Draft invoices. Draft → Confirmed → Paid (Paid is set automatically when fully paid). Cancelled is an extra state, from Draft or Confirmed, only when there are no payments. Send and Print only for Confirmed and Paid. Customers never see Drafts.

### Discounts
- **D-21 Automatic, no codes, no per-customer targeting.** Evaluated only inside invoice generation, for every subscription the rule fits: within its start and end dates, uses remaining, and its condition met. Scope "products" covers matching product lines only; scope "whole subscription" covers every invoice line including the plan fee. Each rule has **one condition**: none, a minimum purchase (pre-discount amount of the eligible lines), or a minimum quantity (quantity of the eligible lines). "A customer asks for a better price for more seats" = a minimum-quantity rule. Applies from the next invoice, never retroactively.
- **D-22 One discount per invoice.** Of all fitting rules, apply the one with the biggest saving (tie: earliest end date, rules without an end date last, then lowest id).
- **D-23 Usage limit is atomic.** Inside invoice generation, reserve one use with `UPDATE ... SET used_count = used_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)`; zero rows means exhausted, skip the rule. Redemption states: reserved → committed (invoice confirmed) → released (invoice cancelled; `used_count` decremented). Never read-then-write.

### Payments and reporting
- **D-24 Payments.** Several per invoice; methods cash, bank transfer, card, UPI, cheque; amount > 0 and ≤ outstanding (overpayment refused); only against Confirmed invoices. Recording a payment locks the invoice, adds to `amount_paid`, and sets Paid when `amount_paid` = total. No "partially paid" status (it is derived). Outstanding = total − payments.
- **D-25 Definitions.** Revenue received = sum of payments in the date range. Outstanding = sum of (total − paid) over Confirmed invoices. Overdue = outstanding with due date before today. Active subscriptions = status Active and not paused (paused and out-of-term shown separately). **MRR** (REP-2) = each active, unpaused subscription's per-period subtotal before discount and tax, normalised to a month (yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12); ARR = MRR × 12.

### Identity and email
- **D-26 Supabase Auth** handles accounts, password hashing, sessions and reset links (AUTH-3). Public sign-ups are turned off in Supabase; our `/api/v1/auth/signup` applies AUTH-2 and creates the account with the service key. Supabase's minimum password length is set to 9 as a backstop.
- **D-27 User is not Customer.** `profiles` (one per login, holds the role) and `customers` (business record, may exist without a login, `user_id` nullable and unique). Self-signup creates both. The role is never taken from the client. A login is linked to a customer record that staff created earlier only after the email is verified.
- **D-28 Email.** Supabase Auth sends auth emails through our SMTP (Resend or Gmail). Invoice "Send" emails from the server and writes an `email_log` row (sent / failed / skipped). The UI never says "sent" unless the log says sent.
- **D-29 Time.** Business dates are DATE columns in **Asia/Kolkata** (`today_ist()`); timestamps are UTC.

## 4. Domain model (docs/SPEC.md holds the columns)

- **Identity:** Profile · Customer
- **Configuration:** Product · ProductVariant · Tax · PaymentTerm · Plan · QuoteTemplate + QuoteTemplateLine · DiscountRule (+ products) · AppSetting
- **Subscriptions:** Subscription · SubscriptionLine · SubscriptionStatusHistory
- **Billing:** BillingRun · Invoice · InvoiceLine (kind: plan_fee or product) · DiscountRedemption
- **Finance:** Payment · EmailLog

## 5. Roles and permissions

| Capability | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Add or deactivate staff | ✔ | ✖ | ✖ |
| Products, variants, plans (incl. switches), taxes, payment terms, quotation templates, discount rules | create / edit | read | read products and plans only |
| Customer records | ✔ | create / edit | own profile |
| Subscriptions: create, edit, transition | ✔ | ✔ | ✖ |
| Subscriptions: view | all | all | own, never Draft |
| Pause / resume / renew / close | ✔ (close always) | ✔ when the plan allows | own, when the plan allows |
| Run billing, see billing runs | ✔ | ✔ | ✖ |
| Invoices: confirm, cancel, send, print | ✔ | ✔ | own: view and print (not Draft) |
| Payments: record | ✔ | ✔ | ✖ |
| Payments: view | ✔ | ✔ | own |
| Reports and dashboard | ✔ | ✔ | ✖ |

Every endpoint checks the role, and Row Level Security repeats it in the database. Customer data is always filtered by the session's customer, so changing an id in the URL returns 404. The role never comes from a request body.

## 6. Non-functional requirements

- **NFR-1:** under 2 s per page and API at the seeded volume. Server-side pagination (default 20, max 100), filtering and sorting on every list. Dropdowns search as you type. Dashboard numbers come from SQL aggregates on indexed columns. No N+1 queries.
- Real data from the database everywhere: no static JSON, no hardcoded rows, no fake charts.
- One shared Zod schema library for client and server, one error format.
- Responsive UI, consistent components, empty / loading / error states, status badges everywhere.
- No secrets in the repo (`.env.example` only); no sensitive data in logs or error messages.

## 7. Scope

- **Must:** everything in section 2 and D-1 to D-29; manual and scheduled billing; portal; dashboard with filters; seed data and the speed proof.
- **Should:** bulk confirm of invoices, billing dry-run preview, upcoming renewals and out-of-term widget, MRR/ARR cards.
- **Could:** portal quote acceptance, customer add-on toggles, PDF download.
- **Out (stated in the README):** real payment gateway, proration, refunds and credit notes, multi-currency, dunning, CSV import/export.

## 8. Seed data and demo

Seed (scripted, deterministic): 1 admin, 2 staff, ~1,500 customers including one demo customer login; ≥ 8 products (one with Brand variants: Odoo +560); plans covering each billing period and different switch combinations; 3 demo taxes; payment terms Immediate, Net 15, Net 30; ≥ 4 discount rules (10% from 10 seats; a fixed amount off a minimum purchase; one with usage limit 3; one expiring soon); ≥ 5,000 subscriptions across all statuses, including paused and out-of-term, with ~300 due today; ≥ 20,000 past invoices (paid, partially paid, outstanding, overdue) with consistent payments. Demo credentials go in the README.

Demo (~4 minutes): (1) setup: product with Odoo variant +560, plan, tax, discount, 35 s; (2) quotation from template to Active, 40 s; (3) billing run on the seeded due subscriptions, correct maths, second run creates zero, 65 s; (4) two payments on one invoice, balance, then Paid, 35 s; (5) dashboard: revenue, outstanding, overdue, filters, measured response time, MRR as an extra KPI, 35 s; (6) customer portal isolation and password reset by real email, 30 s. Hard parts to mention: idempotent billing, atomic discount limit, speed at scale.

## 9. Working agreement for agents

1. Before coding: read sections 0–3, `docs/SPEC.md` and your slice in `docs/TASKS.md`. Restate the task in one sentence and list the requirement IDs it covers.
2. Stay inside your slice's folders. Shared files (core migrations, `src/lib/**`, `src/components/ui/**`, layout and navigation, `package.json`, `docs/SPEC.md`) change only through the lead.
3. Never invent. Log `QUESTION:` in `docs/diff.md` instead of guessing; never silently deviate from section 3.
4. Status changes only through the lifecycle functions that check the allowed transitions and write history. No direct status updates anywhere else.
5. Money is `numeric` in SQL and computed only in SQL. The UI shows server totals and never recomputes them.
6. Every endpoint is role-checked; customer data is filtered by the session's customer. Add a test for each.
7. No fake functionality: no hardcoded rows, stub endpoints or silent TODOs. Flag anything unfinished in `docs/diff.md`.
8. Each requirement ID under AUTH, BILL, DISC and PAY has at least one automated check. The golden-path test (`npm run smoke`, lead-owned) must stay green. Run typecheck and tests before reporting done.
9. Small commits, cite IDs. No new dependencies without the lead's approval. Migrations are additive only.
10. Report at the end of each task: files changed, requirement IDs covered, how to verify, assumptions, open questions.
