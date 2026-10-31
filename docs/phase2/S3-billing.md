# S3 · Billing and invoices: your Phase 2 instructions

**Branch:** `s3-billing` · **Owner:** PRANAV P P · **Demo:** scene 3 (65 s, the longest and most judged)
**You deliver:** due subscriptions produce correct invoices exactly once; the team confirms, cancels, sends and prints them.
**Requirement IDs:** BILL-1, BILL-2, BILL-3, BILL-4, DISC-3 · **Decisions:** D-1, D-3, D-4, D-5, D-15…D-23, D-28

Read first: `context.md` (§3 D-1, D-3…D-5, D-15…D-23), `docs/SPEC.md` (§2 billing tables and function contracts, §3 S3 endpoints), `PHASE2.md`. **The lead reviews every change to money math or idempotency.**

---

## 1. What you own (edit only these)
```
src/app/app/invoices/**          src/app/api/v1/billing/**
src/app/app/billing/**           src/app/api/v1/invoices/** (NOT invoices/[id]/payments — that's S4)
src/app/print/**                 src/components/s3/**
src/lib/validation/s3.ts         supabase/migrations/0300_s3_billing.sql
```
Tables: `billing_runs`, `invoices`, `invoice_lines`, `discount_redemptions`, `email_log`.

**Your SQL functions already exist** in `0300_s3_billing.sql` with a working baseline: `run_billing(as_of, trigger)`, `preview_billing(as_of)`, `invoice_confirm(id)`, `invoice_confirm_many(ids)`, `invoice_cancel(id, reason)`, `invoice_mark_sent(id)`. Keep names and parameters. You call S2's `process_lifecycle(as_of)` but don't edit it. S4's Record-payment dialog appears on your invoice detail page: import it from `src/components/s4/record-payment.tsx`.

## 2. Build order (PR after steps 2, 4 and 6)
1. **Billing runs screen** (`/app/billing`): an "as of" date (default today), a **Run billing** button → `POST /billing/run` → result card (created / skipped / failed + failure reasons); history table from `GET /billing/runs`.
2. **Invoices list** (`/app/invoices`): from the `invoice_list` view; tabs Draft / Confirmed / Overdue / Paid / Cancelled; filters customer, subscription, date range; search by number; checkbox **bulk confirm** → `POST /invoices/confirm`. **First PR.**
3. **Invoice detail** (`/app/invoices/[id]`): bill-to (from `customer_snapshot`), period, invoice / due dates, payment terms; lines table with amount, discount, tax name and rate, tax amount, total; totals block; discount name; payments list. Buttons by status: Confirm (Draft), Cancel (Draft or Confirmed with no payments), Send and Print (Confirmed / Paid), Record payment (S4 component, Confirmed only).
4. **Print page** (`/print/invoices/[id]`): clean A4 layout, opens the browser print dialog. Staff, admin and the owning customer (never Draft). **Second PR.**
5. **Send**: `POST /invoices/:id/send` → email to the customer from the server (Resend / SMTP via `src/lib/email.ts`) → write `email_log` (sent / failed / skipped) → `invoice_mark_sent`. The UI says "Sent" only if the log says sent.
6. **Check and harden the engine** in `0300_s3_billing.sql` against the decisions:
   - Due (D-16): Active, not paused, `next_invoice_date ≤ as_of`, period start before expiry. Period n = `add_period(anchor, period, n)`, never repeated addition; catch up one invoice per missed period.
   - Lines (D-1): plan fee line (if price > 0, plan tax) + one line per subscription line (line tax).
   - **One** discount (D-21, D-22): best saving among fitting rules; scope products = matching lines, scope subscription = all lines incl. plan fee; one condition; reserve the use atomically (D-23).
   - Math (D-3): amount → discount spread in proportion (remainder on the largest line) → tax on the discounted amount → rounded per line → totals = sums.
   - Snapshots (D-5), due date = generation date + term days (D-16).
   - Idempotency (D-17): advisory lock, savepoint per subscription, `FOR UPDATE SKIP LOCKED`, unique (subscription, period_start).

   **Third PR.**
7. **Scheduler** (D-19): `pg_cron` job calling `run_billing(today_ist(), 'scheduled')` daily, only when `app_settings.scheduler_enabled = true`. Keep it **off** for the demo.
8. **Should:** "Preview" button → `GET /billing/preview?as_of=` (what a run would create, no writes).

## 3. Rules you must enforce
- Billing, confirm, cancel, send: staff and admin only (403 otherwise). Customers read only their own non-Draft invoices (404 for others).
- Draft → Confirmed → Paid. Cancel only with no payments (`CANNOT_CANCEL`); cancelling releases the discount use (`used_count − 1`). Confirming a 0 total invoice marks it Paid.
- Confirmed invoices are read-only. Nobody edits invoice lines; only billing writes them.
- Second run on the same date must create **0** invoices.
- **Don't add:** proration, credit notes, multiple discounts per invoice, multiple taxes per line, gateway payments.

## 4. Claude Code prompt
```
You are working on slice S3 (Billing and invoices) of this repo.
Read context.md, docs/SPEC.md, PHASE2.md and docs/phase2/S3-billing.md in full before writing code.
Only edit the files listed under "What you own". If you need anything else, stop and tell me.
Money is computed only in SQL (numeric, never float). Keep function names and parameters from SPEC §2.
Follow D-1, D-3…D-5 and D-15…D-23 exactly. Never weaken idempotency (advisory lock, savepoints, unique index).
Next task: <paste one item from "Build order">. Show me a short plan first, then implement, then run npm run typecheck.
```

## 5. Done when
- [ ] The ~300 seeded subscriptions due today are billed in one run; the result card shows the counts; a second run creates 0.
- [ ] A monthly subscription starting 31 Jan gets periods 28 Feb, 31 Mar, 30 Apr (check with `select add_period('2026-01-31','monthly', n)`).
- [ ] Hand-checked invoice: plan fee ₹1,000 + 12 × Odoo seat ₹1,060 = ₹12,720 product line; "10% from 10 seats" → −₹1,272; GST 18% (demo) on 11,448 = ₹2,060.64; plan fee tax ₹180; total = 1,000 + 180 + 11,448 + 2,060.64 = **₹14,688.64**. The screen shows exactly that.
- [ ] A rule with usage limit 3 is used exactly 3 times, even when two runs start at the same moment (the second gets `BILLING_RUN_IN_PROGRESS`).
- [ ] Cancelling an invoice gives its discount use back.
- [ ] Send writes an `email_log` row and the real email arrives; Print shows an A4 invoice.
- [ ] Paused and out-of-term subscriptions are not billed.
- [ ] `npm run typecheck` passes; PR merged.

## 6. Demo script (scene 3, 65 s)
"Hundreds of subscriptions are due today." Billing runs → Run billing → result card (≈300 created, 0 failed) → Run again → 0 created ("nothing is billed twice") → open one invoice → walk the lines: plan fee, Odoo seats, 10% discount, 18% tax on the discounted amount, totals → Confirm → Print.
