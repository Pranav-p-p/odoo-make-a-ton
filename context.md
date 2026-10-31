# Brightloop Subscription Management System: Agent Context

Make-A-Ton 9.0 (Odoo x CUSAT) virtual round, 31 Oct 2026 · 8-hour build · v1.0 · lead-owned · save as context.md

## 0. How to use this file

1. This is the shared context for every human and agent on the build. Read it fully before touching code, then read SPEC.md and your slice in TASKS.md.
2. Order of authority: (1) the original problem statement, saved verbatim as docs/problem-statement.md; (2) the locked decisions in section 3 (our assumptions, labelled A-n); (3) SPEC.md (schema, API contracts); (4) TASKS.md. A lower item never overrides a higher one.
3. Do not invent requirements, states, fields or rules. If something is ambiguous or missing, stop, write `QUESTION:` in diff.md and ask the lead.
4. The judges are Odoo engineers who walk through each scene of the statement and probe edge cases. Every requirement ID in section 2 must be demonstrable.
5. Human-owned areas: agents may propose changes but must not merge them without lead review: (a) database schema and constraints, (b) billing engine and idempotency, (c) discount, tax and money math, (d) authorization and the golden-path integration test.

## 1. The business in one minute

Brightloop Software sells everything on subscription: business software billed monthly or yearly, add-ons customers switch on and off, and a few products that come in variants. Customers range from small shops on monthly plans to large companies on yearly contracts.

Today: subscriptions live in a spreadsheet, renewals are remembered by whoever notices first, invoices are typed by hand, payments are matched by scrolling bank statements, and revenue reports are built manually each quarter. Result: missed renewals, wrong invoices, and nobody can say how much recurring revenue exists.

The task: one platform for the whole life of a subscription: products and plans, quotations, subscriptions, invoices, payments, revenue reporting.

Actors: **Admin** (controls the whole system; sets up products, plans, taxes, discounts and staff), **Staff** (internal team, day-to-day work, limited access), **Customer** (self-service portal; sees only their own subscriptions and invoices).

## 2. Requirements register (from the statement)

Each line is testable. Cite the ID in tests and commits.

**AUTH**

- AUTH-1 Customers sign up with email and password. One email belongs to only one account.
- AUTH-2 Password must be MORE than 8 characters (so 9 or more) with at least one uppercase, one lowercase and one special character. No digit rule. Regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{9,}$`. Enforce on client and server.
- AUTH-3 Forgot password: a reset link arrives at the registered email.
- AUTH-4 Three roles: admin (whole system), staff (day-to-day, limited access), customer (portal, only own subscriptions and invoices).
- AUTH-5 Only the admin can add a staff member.

**CAT: catalogue**

- CAT-1 Admin adds a product: name, type, sales price, cost price, notes.
- CAT-2 Products come in variants (for example by brand); choosing the Odoo brand adds 560 to the price.
- CAT-3 Admin adds a plan: price, billing period (daily, weekly, monthly or yearly), minimum quantity, dates it is available.
- CAT-4 Per plan, admin decides which apply: closes on its own when it ends, can be closed early, can be paused, can be renewed.
- CAT-5 Admin sets up taxes (rules) and discounts.
- CAT-6 Quotation template: plan and product lines, valid for a set number of days.

**SUB: subscriptions**

- SUB-1 A sales rep starts a quotation from a template instead of from scratch.
- SUB-2 A subscription has its own number, a customer, a plan, start date, expiry date, payment terms, and lines (product, quantity, unit price, taxes, amount).
- SUB-3 Status flow Draft → Quotation → Confirmed → Active → Closed. Anyone on the team can see where it stands.
- PORTAL-1 Customers see and manage their own subscriptions without emailing anyone.

**BILL: invoices**

- BILL-1 Invoices are created from subscriptions with customer details, product lines, taxes and totals already filled in. Nobody types invoices by hand.
- BILL-2 Taxes are calculated automatically from rules the admin has set.
- BILL-3 The team can confirm, cancel, send or print any invoice. Status flow Draft → Confirmed → Paid.
- BILL-4 Hundreds of subscriptions can be due at once. Nothing is billed twice or skipped.

**DISC: discounts**

- DISC-1 Only the admin creates discount rules: fixed amount or percentage, minimum purchase or quantity, start and end dates, a limit on how many times it can be used.
- DISC-2 A discount can apply to specific products or to whole subscriptions.
- DISC-3 Once it applies it appears on the next invoice on its own, and stops when it expires or runs out.

**PAY: payments**

- PAY-1 Payments arrive by different methods on different days. Record method, amount, date and a note against the right invoice.
- PAY-2 At any moment the team can see which invoices are paid and which are outstanding, so overdue ones can be chased.

**REP: reporting**

- REP-1 One place for the finance lead: active subscriptions, revenue received, amount still owed, payments, overdue invoices, with filters and a summary view.
- NFR-1 With thousands of subscriptions, every page responds in under two seconds.

## 3. Locked decisions (our assumptions where the statement is silent or ambiguous)

### Pricing and money

- **A-1 Plan fee is a separate, visible recurring charge.** An invoice is: plan fee line (plan price x 1, shown by name, omitted when the price is 0) + one line per subscription line (unit price = product sales price + variant extra, snapshotted when the line is added) − discount + tax. Never add a charge the sales rep or customer cannot see.
- **A-2 Minimum quantity.** The sum of quantities across the subscription's product lines (plan fee excluded) must be ≥ the plan's minimum quantity. Checked on Quotation → Confirmed and on every later line change.
- **A-3 Calculation order.** Line amount = quantity x unit price → discount → tax on the discounted amount → totals. Money is Decimal (`numeric(12,2)`), never float. Round half-up to 2 decimals per line; totals are sums of rounded lines. A discount is allocated to its eligible lines proportionally, with the rounding remainder on the largest line; a fixed discount never exceeds its eligible base.
- **A-4 Taxes are data, not code.** A tax is a name plus a rate percent, managed by the admin. Products have a default tax, a line can override it, the plan fee uses the plan's optional tax. No rate is hardcoded; the seed may contain `GST 18% (demo)` clearly labelled as demo data.
- **A-5 History is immutable.** Subscription lines snapshot description and unit price when added. Invoices snapshot everything: customer details, line descriptions, quantities, prices, discounts, tax name and rate, payment-term name and days, due date. Later edits to products, plans, taxes or terms never change existing documents. Confirmed invoices are read-only.

### Subscription lifecycle

- **A-6 Transitions** (enforced on the server; each writes SubscriptionStatusHistory with who and when):
  - Draft → Quotation: send quotation; sets `quote_valid_until` = today + template validity days (setting, default 30, for quotes without a template).
  - Quotation → Confirmed: blocked if the quote has expired, A-2 fails, or the start date is outside the plan's availability dates.
  - Confirmed → Active: automatic once start date ≤ today, or manual Activate. Sets `next_invoice_date` = start date.
  - Active → Closed: early close (only if the plan allows it) or automatic close (only if the plan has auto-close, once expiry date ≤ today). Draft, Quotation and Confirmed can be closed (discarded) by staff.
  - Plans without auto-close: subscriptions stay Active after expiry and show an expired, renewal needed badge.
- **A-7 Pause, renew, close** are gated by the plan's switches in both UI and API. Pause is a flag (`is_paused`) on an Active subscription, so the five statuses stay exactly as in the statement; billing is skipped while paused and restarts from the resume date. Renew extends expiry by one plan period and is logged. Customers may pause, renew or close their own Active subscription when the plan allows it; staff and admin may do so for any. Line changes on an Active subscription affect the next invoice only (no proration) and must still satisfy A-2.
- **A-8 Plan availability dates** only decide whether a new subscription may start on that plan. They never alter existing subscriptions.
- **A-9 Derived, never stored:** quote expired, subscription expired, invoice overdue, and invoice payment state (unpaid, partially paid, paid).

### Billing engine

- **A-10 One billing service, two triggers.** A manual Run billing action (admin or staff, with an as-of date for demos) and a scheduled periodic worker (interval from env). Both call the same function.
- **A-11 Billing in advance.** A subscription is due when status = Active, not paused, `next_invoice_date` ≤ as-of date, and the period start is before the expiry date. Period n starts at start date + n x period (calendar-aware, month-end clamped), computed from the anchor date, never by repeated addition. No proration. Missed periods are caught up, one invoice per period. Invoice date = period start.
- **A-12 Idempotency.** Unique `(subscription_id, period_start)` on invoices; each subscription is processed in its own transaction with `SELECT ... FOR UPDATE SKIP LOCKED`; a Postgres advisory lock stops two runs overlapping; one failing subscription never aborts the batch. Running twice creates zero new invoices.
- **A-13 BillingRun** records the as-of date, trigger (manual or scheduled), who triggered it, start and end time, created, skipped and failed counts, and failure reasons. The UI shows the summary after every run.
- **A-14 Scheduler caution.** The scheduler is configurable and stays OFF while seeding and preparing the demo, otherwise it can consume the due-today subscriptions before the live run. Demonstrate the scheduled path by shortening its interval and showing a BillingRun with trigger = scheduled.
- **A-15 Invoice lifecycle.** Billing creates Draft invoices. Draft → Confirmed → Paid (Paid happens automatically when fully paid). Cancelled is an extra state, allowed from Draft or Confirmed only when no payment exists. Send and print are allowed in any state except Cancelled. Due date = invoice date + payment-term days, stored on the invoice.

### Discounts

- **A-16 Automatic, no promo codes.** Evaluated inside invoice generation for every subscription that meets the rule: within start and end dates, uses remaining, and eligible. Product scope covers matching product lines only; whole-subscription scope covers every invoice line including the plan fee. Minimum purchase = pre-discount amount of the eligible lines; minimum quantity = quantity of the eligible lines. Applies from the next invoice generated, never retroactively.
- **A-17 One discount per invoice, no stacking.** Evaluate all eligible rules and apply the one with the greatest saving (tie: earliest end date, then lowest id).
- **A-18 Usage is reserved, then committed.** Inside the invoice-generation transaction, reserve one use with an atomic conditional update (`UPDATE discount_rules SET used_count = used_count + 1 WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)`); zero rows updated means exhausted, so skip that rule. Redemption states: RESERVED → COMMITTED (invoice confirmed) → RELEASED (invoice cancelled; decrement `used_count`). Never read then write.

### Payments and reporting

- **A-19 Payments.** Several per invoice; methods: cash, bank transfer, card, UPI, cheque; amount > 0 and ≤ outstanding (overpayment rejected); only against Confirmed invoices. Posting a payment locks the invoice row, increases `amount_paid`, and sets Paid when `amount_paid` = total. There is no PARTIALLY\_PAID status. Outstanding = total − sum of payments.
- **A-20 Definitions.** Collected = sum of payments in the date range. Outstanding = sum of (total − paid) over Confirmed invoices. Overdue = outstanding with due date before today. Active subscriptions = status Active (paused shown separately). **MRR and ARR are additional KPIs and must be labelled that way**: each Active, unpaused subscription's per-period subtotal (before discount and tax) normalised to a month (yearly ÷ 12, weekly x 52 ÷ 12, daily x 365 ÷ 12); ARR = MRR x 12.

### Identity and email

- **A-21 User is not Customer.** User = login (email, role). Customer = business record that may exist without a login (staff quoting a large customer); `customers.user_id` is nullable and unique. Self-signup creates both. The role is never accepted from the client.
- **A-22 Email.** Every email is an EmailOutbox row (queued → sent or failed, attempts, last error). A worker sends through SMTP when configured, with retries. The UI never claims sent unless the status is sent. In development, an in-app Development mail inbox page shows the outbox, clearly labelled.
- **A-23 Reset and login security.** Reset tokens are random, stored hashed, expire in 30 minutes and are single-use. The forgot-password response is identical whether or not the email exists. Login and reset are rate-limited. Emails are stored lowercase with a unique index.
- **A-24 Time.** Business dates are DATE columns in Asia/Kolkata; timestamps are UTC.

## 4. Domain model (conceptual; SPEC.md holds the full schema)

- **Identity:** User · Customer · ResetToken · EmailOutbox
- **Configuration:** Product · ProductVariant (attribute, value, extra\_price) · Tax · PaymentTerm (name, days) · Plan (price, billing\_period, min\_quantity, available\_from/to, auto\_close, allow\_early\_close, allow\_pause, allow\_renew, optional tax) · QuoteTemplate + QuoteTemplateLine · DiscountRule (+ product list) · DiscountRedemption (rule, invoice, state)
- **Subscriptions:** Subscription (number, customer, plan, status, start/expiry, payment term, is\_paused, next\_invoice\_date, quote\_valid\_until) · SubscriptionLine · SubscriptionStatusHistory
- **Billing:** BillingRun · Invoice (number, period start/end, invoice and due dates, status, totals, amount\_paid, snapshots) · InvoiceLine (kind: PLAN\_FEE or PRODUCT)
- **Finance:** Payment

Key relations: Customer 1—0..1 User; Customer 1—n Subscription; Plan 1—n Subscription and QuoteTemplate; Subscription 1—n SubscriptionLine and Invoice; Invoice 1—n InvoiceLine and Payment; BillingRun 1—n Invoice; DiscountRule 1—n DiscountRedemption n—1 Invoice; Product 1—n ProductVariant.

Database-level invariants (not only in app code): unique lowercase user email; unique (subscription\_id, period\_start) on invoices; unique (rule\_id, invoice\_id) on redemptions; payment amount > 0; amount\_paid ≤ total; plan min\_quantity ≥ 1; money as numeric; foreign keys everywhere; sequences for SUB- and INV- numbers.

Required indexes: subscriptions(status, next\_invoice\_date), subscriptions(customer\_id), invoices(status, due\_date), invoices(customer\_id), invoices(subscription\_id), payments(invoice\_id), payments(paid\_on), discount\_rules(is\_active, starts\_on, ends\_on).

## 5. Roles and permissions

| Capability | Admin | Staff | Customer |
| --- | --- | --- | --- |
| Add or disable staff | ✔ | ✖ | ✖ |
| Products, variants, plans (incl. switches), taxes, payment terms, templates, discount rules | create/edit | read | ✖ |
| Customer records | ✔ | create/edit | own profile |
| Subscriptions | all | all (create, transition) | own: read, plus pause/renew/close when the plan allows |
| Run billing | ✔ | ✔ | ✖ |
| Invoices (confirm, cancel, send, print) | ✔ | ✔ | own: read, print |
| Payments | record, view | record, view | own: view |
| Reports and dashboard | ✔ | ✔ | ✖ |
| Development mail inbox | ✔ | ✖ | ✖ |

Every endpoint checks the role. Customer queries are always filtered by the session's customer\_id, so changing an id in the URL returns 403 or 404. Role never comes from the request body.

## 6. Non-functional requirements

- **Performance (NFR-1):** p95 under 2 seconds per page and API at the seeded volume. Server-side pagination (default 20, max 100), filtering and sorting on every list. Dropdowns use search-as-you-type, never load whole tables. Dashboard numbers come from SQL aggregates (GROUP BY, SUM) on indexed columns. No N+1 queries. Log the duration of every request.
- Real, dynamic data from the database everywhere. No static JSON and no hardcoded rows.
- Validate on client and server with one shared schema library and one error format.
- Responsive UI with consistent components, clear empty, loading and error states, and status badges everywhere.
- Security basics: argon2 or bcrypt, parameterized queries, HTTPS in deployment, no secrets in the repo, an `.env.example`, no sensitive data in logs or error messages.
- PostgreSQL is required (row locks, advisory locks, numeric). Use raw SQL where the ORM cannot express locks.

## 7. Scope

- **Must:** everything in section 2, decisions A-1 to A-24, manual and scheduled billing, portal basics, dashboard with filters, seed data and the performance proof.
- **Should:** bulk confirm and send of invoices, billing dry-run preview, overdue reminder emails, upcoming-renewals widget, CSV export, MRR and ARR cards.
- **Could:** portal quote acceptance, customer add-on toggling, simulated online payment, PDF generation, CGST/SGST split, charts.
- **Out (state it in the README):** real payment gateway, proration, credit notes, multi-currency, dunning schedules.

## 8. Seed data and demo

Seed (scripted, deterministic): 1 admin, 2 staff, about 1,500 customers including a demo customer login; at least 8 products (one with Brand variants: Odoo +560, others); plans covering each billing period and different switch combinations; 3 demo taxes; payment terms Immediate, Net 15, Net 30; at least 3 discount rules (10% from 10 seats; a fixed amount off a minimum purchase; one with usage limit 3; one expiring soon); at least 5,000 subscriptions across statuses with about 300 due today; at least 20,000 historical invoices (paid, partially paid, outstanding, overdue) with consistent payments. List demo credentials in the README.

Demo (about 4 minutes): (1) setup: product with Odoo variant +560, plan, tax, discount, 35 s; (2) quotation from template to Active, 40 s; (3) billing run on seeded due subscriptions, correct maths, second run creates zero, 65 s; (4) two payments on one invoice, remaining balance, then Paid, 35 s; (5) dashboard: collected, outstanding, overdue, filters, measured response time, MRR and ARR as additional KPIs, 35 s; (6) customer portal isolation and password reset via real email or the labelled development inbox, 30 s. Hard parts to mention: idempotent billing, atomic discount limit, speed at scale.

## 9. Working agreement for agents

1. Before coding: read sections 0 to 3, SPEC.md and your slice in TASKS.md. Restate the task in one sentence and list the requirement IDs it covers.
2. Stay inside your slice's folders. Shared files (schema, shared contracts, layout and navigation, package.json, SPEC.md, CLAUDE.md) change only through the lead.
3. Never invent. Log `QUESTION:` in diff.md instead of guessing, and never silently deviate from section 3.
4. Status changes happen only through service functions that enforce the allowed transitions and write history. No direct status updates elsewhere.
5. Money is Decimal only. Pricing, tax and discount logic lives in one shared module with unit tests. The UI displays server-computed totals and never recomputes them.
6. Every endpoint is role-checked and customer data is filtered by the session's customer\_id. Add a test for each.
7. No fake functionality: no hardcoded rows, stub endpoints or silent TODOs. Flag anything unfinished in diff.md.
8. Each requirement ID under AUTH, BILL, DISC and PAY has at least one automated test. The golden-path end-to-end test (lead-owned) must stay green. Run lint, typecheck and tests before reporting done.
9. Small commits. No new dependencies without approval. After the v0-skeleton tag, migrations are additive only and coordinated through the lead.
10. Report at the end of each task: files changed, requirement IDs covered, how to verify (commands or URLs), assumptions made, open questions.

## 10. Open items (defaults apply until the lead decides)

- Tax on the plan fee: use the plan's optional tax; none if unset.
- Validity of quotes without a template: 30 days (setting).
- Staff may run billing: yes.
- Customers accepting quotes in the portal: Could.
- Product type values: Service, Software, Add-on, Other.
