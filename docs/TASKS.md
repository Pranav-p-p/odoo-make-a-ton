# TASKS: four independent vertical slices

Read `context.md` and `docs/SPEC.md` first. Each slice owns its **screens, API routes, SQL functions and checks** end to end, in its own folders (SPEC §7). Slices do not wait for each other: they build against the contracts in SPEC §2–3 and the seeded data.

**Deadline 17:00 IST.** Code freeze 16:30.

## How the slices stay independent
1. **Core first (lead + Claude Code, ready by 13:45):** schema, RLS, auth, app shell, API wrapper, shared Zod and types, UI kit, seed, golden test. After that nobody edits core files without the lead.
2. **Contract functions ship working on day one.** Core creates every SQL function in the SPEC §2 contract table with its final signature and a working baseline (taken from the tested prototype). The owning slice then completes it to every decision. So S3's billing run works before S2 finishes the lifecycle rules, and S4 has invoices to pay before S3 finishes the billing engine.
3. **Seed data covers every slice:** products, plans, templates, rules, 5,000 subscriptions in every state, ~300 due today, 20,000 past invoices with payments. Every slice can demo its part on seeded data alone.
4. **One branch per slice** (`s1-catalog`, `s2-subscriptions`, `s3-billing`, `s4-finance`) off `main`; small PRs into `main`; the lead reviews anything touching schema, billing, money math or auth.

## Coverage: every requirement has an owner

| Requirement | Owner | Decisions |
| --- | --- | --- |
| AUTH-1, AUTH-2, AUTH-3, AUTH-4 | Core | D-26, D-27 |
| AUTH-5 | S2 | D-27 |
| CAT-1, CAT-2, CAT-3, CAT-4, CAT-5, CAT-6 | S1 | D-4, D-11 |
| DISC-1, DISC-2 (rules and setup) | S1 | D-21 |
| SUB-1, SUB-2, SUB-3, PORTAL-1 | S2 | D-2, D-5…D-14 |
| BILL-1, BILL-2 (calculation), BILL-3, BILL-4 | S3 | D-1, D-3, D-15…D-20 |
| DISC-3 (applying discounts) | S3 | D-21…D-23 |
| PAY-1, PAY-2 | S4 | D-24 |
| REP-1, REP-2 | S4 | D-25 |
| NFR-1 | all; the measured proof is S4 | §6 of context.md |

---

## Core: foundation (lead + Claude Code) · 12:45 → 13:45

- [ ] Supabase project; `.env.local` shared privately; Auth: public sign-ups off, confirm email on, min password length 9, SMTP set
- [ ] `0001_core_schema.sql`, `0002_core_security.sql`, `0003_core_views.sql` per SPEC §2
- [ ] Contract functions with working baselines (SPEC §2 table)
- [ ] Auth: `/auth/*`, `/me`, signup (AUTH-2), login, forgot/reset, callback; middleware; role guard; profile trigger
- [ ] API wrapper (validation, role check, error format), shared Zod schemas, `types.ts`, typed API client, SWR hooks
- [ ] App shell: console and portal layouts, nav per role (SPEC §5), UI kit, a starter page per screen
- [ ] Seed per SPEC §6 (`npm run seed`); scheduler job created but disabled
- [ ] Golden test `npm run smoke` per SPEC §1 demo path
- [ ] README: setup, demo logins, out-of-scope list
- **Done when:** the console and portal load for each role on seeded data; `npm run typecheck` passes; smoke runs the auth and role checks green.

---

## S1 · Commercial setup · owner: ________

**Goal:** the admin can configure everything needed to sell a subscription.
**IDs:** CAT-1…CAT-6, CAT-5 taxes, DISC-1, DISC-2.
**Owns:** `src/app/app/{products,plans,templates,discounts,settings}/**`, `src/app/api/v1/{products,plans,taxes,payment-terms,quote-templates,discount-rules}/**`, `src/components/s1/**`, `src/lib/validation/s1.ts`, `0100_s1_catalog.sql` (only if needed).

- [ ] Products: list (search, type filter, archived toggle), create/edit form (name, type, sales price, cost price, notes, default tax), archive
- [ ] **Variants table** on the product: attribute, value, extra price, live final price (base + 560 for Odoo)
- [ ] Plans: list; form with price, billing period, minimum quantity, available from/to, tax, and the four switches with a one-line explanation each (auto-close, early close, pause, renew)
- [ ] Taxes and payment terms: one settings screen with inline add/edit and archive
- [ ] Quotation templates: plan, validity days, product lines (product, variant, quantity); shows the effective price per line
- [ ] Discount rules: kind (fixed / %), value, scope (products picker or whole subscription), one condition (none / min purchase / min quantity + value), start/end dates, usage limit; shows **used / limit** and an "expired" or "used up" badge
- [ ] Writes are admin-only (API + RLS); staff see read-only screens
- **Done when:** a new product with the Odoo variant, a monthly plan, a tax and a "10% from 10 seats" rule can be created in the UI in under a minute; staff get 403 on every write; validation errors show per field.
- **Demo:** scene 1 (35 s).

---

## S2 · Customers and subscriptions · owner: ________

**Goal:** a customer exists in the system, and the team turns an offer into an active subscription that is managed through its whole life; customers manage their own in the portal.
**IDs:** AUTH-5, SUB-1, SUB-2, SUB-3, PORTAL-1; D-2, D-5…D-14.
**Owns:** `src/app/app/{subscriptions,customers,users}/**`, `src/app/portal/**`, `src/app/api/v1/{admin,customers,subscriptions}/**`, `src/components/s2/**`, `src/lib/validation/s2.ts`, `0200_s2_lifecycle.sql`.

- [ ] Users (admin): add staff (invite email), change role, deactivate (AUTH-5)
- [ ] Customers: list with search, create/edit, detail with their subscriptions and invoices
- [ ] New subscription: **from template** (template + customer + dates + payment terms) or blank (plan + lines); number `SUB-…`
- [ ] Subscription detail: header (editable in Draft/Quotation), **lines editor** with live totals from the server, status buttons from `allowed_actions`, status timeline with who/when, its invoices
- [ ] SQL `sub_transition` (D-7 incl. quote expiry, D-2, plan availability), `sub_set_lines` (D-13, D-2), `sub_pause` / `sub_resume` (D-8, re-anchor at resume date), `sub_renew` (D-10), `sub_close`, `process_lifecycle` (activate, auto-close, out-of-term per D-9)
- [ ] Badges: Quote expired, Paused, **Expired, renewal needed** (out of term)
- [ ] Portal: my subscriptions, detail with pause / resume / renew / close only when the plan allows, my invoices list and detail with print link, profile (no email change)
- **Done when:** template → Draft → Quotation → Confirmed → Active works; an expired quote cannot be confirmed; below-minimum quantity is refused; pause stops billing and resume re-anchors; an out-of-term subscription can only be renewed or closed; a customer cannot see another customer's subscription (404) or any Draft; every transition appears in the history.
- **Demo:** scene 2 (40 s) and the portal half of scene 6.

---

## S3 · Billing and invoices · owner: ________

**Goal:** due subscriptions produce correct invoices exactly once, and the team can confirm, cancel, send and print them.
**IDs:** BILL-1, BILL-2 (calculation), BILL-3, BILL-4, DISC-3; D-1, D-3, D-15…D-23.
**Owns:** `src/app/app/{invoices,billing}/**`, `src/app/print/**`, `src/app/api/v1/{billing,invoices}/**` (not `invoices/[id]/payments`), `src/components/s3/**`, `src/lib/validation/s3.ts`, `0300_s3_billing.sql`.

- [ ] SQL `run_billing(as_of, trigger)`: advisory lock; `process_lifecycle`; due per D-16; each subscription under its own savepoint with `FOR UPDATE SKIP LOCKED`; catch-up; BillingRun with created / skipped / failed and reasons (D-17, D-18)
- [ ] Invoice build: plan fee line + product lines; **one best discount** (D-21, D-22) with atomic reservation (D-23); tax on the discounted amount per line (D-3, D-4); snapshots incl. customer and payment terms (D-5); due date = generation date + term days (D-16)
- [ ] `invoice_confirm` (+ bulk; commits redemption; total 0 → Paid), `invoice_cancel` (no payments; releases redemption), send (email + `email_log`), print page
- [ ] `pg_cron` job calling `run_billing(today_ist(), 'scheduled')`, controlled by `app_settings.scheduler_enabled` (D-19)
- [ ] Screens: Billing runs (Run billing with as-of date, result card, history with failures), Invoices list (status tabs incl. Overdue, date filter, search, bulk confirm), Invoice detail (lines with discount and tax columns, totals, Confirm / Cancel / Send / Print), Print page (A4)
- [ ] Should: `preview_billing` dry run
- **Done when:** the seeded ~300 due subscriptions bill in one run; a second run creates 0; a monthly subscription starting 31 Jan bills 28 Feb, 31 Mar, 30 Apr; the maths matches a hand-checked example (12 × Odoo seat 1,060 − 10% + 18% tax + plan fee); a discount with usage limit 3 is used exactly 3 times even across concurrent runs; a cancelled invoice gives its discount use back.
- **Demo:** scene 3 (65 s).

---

## S4 · Payments and finance · owner: ________

**Goal:** the finance team sees the company's position at once, and payments are recorded against the right invoice.
**IDs:** PAY-1, PAY-2, REP-1, REP-2, NFR-1 proof; D-24, D-25.
**Owns:** `src/app/app/page.tsx` (dashboard), `src/app/app/payments/**`, `src/app/api/v1/{payments,reports}/**`, `src/app/api/v1/invoices/[id]/payments/**`, the Record-payment dialog component used by S3's invoice detail (`src/components/s4/record-payment.tsx`), `src/lib/validation/s4.ts`, `0400_s4_finance.sql`.

- [ ] SQL `record_payment` (lock invoice, only Confirmed, amount ≤ outstanding, Paid at zero balance)
- [ ] Record-payment dialog (amount defaults to the balance; method; date; note); payments list with filters (dates, method, customer)
- [ ] SQL reports per D-25: summary (active, paused/out-of-term counts, revenue received, invoiced, outstanding, overdue count and amount, MRR, ARR), revenue series by month, overdue by age bucket (0–30, 31–60, 61–90, 90+)
- [ ] Dashboard: KPI cards, filters (date range, plan, customer), revenue chart, overdue list linking to invoices; Should: renewals widget (expiring in 30 days, out of term)
- [ ] **Speed proof:** measure every list and the dashboard on the seeded volume (< 2 s), record the numbers in the README
- **Done when:** two payments on one invoice show the balance, then Paid; overpayment and payment on a Draft are refused; the dashboard numbers match a SQL cross-check on the seed; every page is under 2 s at seed volume.
- **Demo:** scenes 4 and 5 (70 s).

---

## Integration · 16:00 → 16:30 (lead)
- [ ] Merge all slices into `main`; `npm run typecheck`; `npm run smoke` green (golden path)
- [ ] Fresh seed on the demo project; scheduler off; ~300 due today
- [ ] Deploy to Vercel; smoke against the deployed URL

## Demo prep · 16:30 → 17:00
- [ ] Code freeze 16:30. Run the 4-minute demo twice (context.md §8)
- [ ] README: setup, logins, decisions summary, out-of-scope list, speed numbers
- [ ] Submit by 17:00
