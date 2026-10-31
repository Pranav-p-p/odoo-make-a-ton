# S4 · Payments and finance: your Phase 2 instructions

**Branch:** `s4-finance` · **Owner:** AKHILESWAR R · **Demo:** scenes 4 and 5 (70 s)
**You deliver:** payments recorded against the right invoice, and one dashboard where the finance lead sees the company's position at once.
**Requirement IDs:** PAY-1, PAY-2, REP-1, REP-2, NFR-1 (the measured proof) · **Decisions:** D-24, D-25

Read first: `context.md` (§2, §3 D-24, D-25, §6 NFR), `docs/SPEC.md` (§2 payments, views, function contracts; §3 S4 endpoints), `PHASE2.md`.

---

## 1. What you own (edit only these)
```
src/app/app/page.tsx (dashboard)        src/app/api/v1/payments/**
src/app/app/payments/**                 src/app/api/v1/reports/**
src/components/s4/**                    src/app/api/v1/invoices/[id]/payments/**
src/lib/validation/s4.ts                supabase/migrations/0400_s4_finance.sql
```
`src/components/s4/record-payment.tsx` is used on S3's invoice detail page: keep its props stable (`invoiceId`, `amountDue`, `onDone`) and tell the S3 owner if they change.

**Your SQL functions already exist** in `0400_s4_finance.sql` with a working baseline: `record_payment(invoice, amount, method, paid_on, note)`, `report_summary(from, to, plan, customer)`, `report_revenue(from, to, bucket)`, `report_overdue()`, `report_renewals(days)`. Keep names and parameters.

## 2. Build order (PR after steps 2, 4 and 5)
1. **Record-payment dialog** (`src/components/s4/record-payment.tsx`): amount (defaults to the balance), method (cash / bank transfer / card / UPI / cheque), date (default today), note → `POST /invoices/:id/payments` → `record_payment`. Shows the new balance; refreshes the invoice.
2. **Payments list** (`/app/payments`): server pagination; filters date range, method, customer; columns date, invoice number (link), customer, method, amount, note. **First PR.**
3. **Report functions to D-25** (`0400_s4_finance.sql`):
   - Revenue received = sum of payments in the date range.
   - Outstanding = sum of (total − paid) over Confirmed invoices.
   - Overdue = outstanding with due date before today; age buckets 0–30, 31–60, 61–90, 90+ days.
   - Active = status Active and not paused (paused and out-of-term counted separately).
   - **MRR** = each active, unpaused subscription's per-period subtotal before discount and tax, normalised to a month (yearly ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12); ARR = MRR × 12.
   - Filters: date range, plan, customer.
4. **Dashboard** (`/app`):
   - KPI cards: active subscriptions, paused / out of term, revenue received, invoiced, outstanding, overdue (count + amount), MRR, ARR.
   - Filters: date range, plan, customer.
   - Revenue chart: received vs invoiced per month (recharts).
   - Overdue list: oldest first, linking to the invoice.

   **Second PR.**
5. **Speed proof (NFR-1):** with the full seed, time the dashboard, `/payments`, `/invoices`, `/subscriptions`, `/customers` APIs (browser network tab or `curl -w '%{time_total}'`). Every one must be under 2 s. Write the numbers into the README's "Speed" table. If something is slow, add an index or aggregate first; ask the lead before changing Core indexes. **Third PR.**
6. **Should:** renewals widget: subscriptions expiring in the next 30 days and out-of-term ones, from `GET /reports/renewals?days=30`.

## 3. Rules you must enforce
- Record payment: staff and admin only. Only against **Confirmed** invoices (`INVOICE_NOT_CONFIRMED`); amount > 0 and ≤ balance (`AMOUNT_EXCEEDS_DUE`). At zero balance the invoice becomes **Paid** automatically.
- "Partially paid" is shown (derived from amount paid), never stored as a status.
- Customers see only their own payments (portal), never reports. Reports are staff and admin only.
- All numbers come from SQL aggregates. **No hardcoded numbers, no fake chart data, no computing totals in the browser.**
- **Don't add:** refunds, dunning, CSV export, gateway integration.

## 4. Claude Code prompt
```
You are working on slice S4 (Payments and finance) of this repo.
Read context.md, docs/SPEC.md, PHASE2.md and docs/phase2/S4-finance.md in full before writing code.
Only edit the files listed under "What you own". If you need anything else, stop and tell me.
Every figure comes from SQL (numeric). Follow D-24 and D-25 exactly; keep function names and parameters.
Next task: <paste one item from "Build order">. Show me a short plan first, then implement, then run npm run typecheck.
```

## 5. Done when
- [ ] On a Confirmed invoice of ₹14,688.64: pay ₹5,000 by UPI → balance ₹9,688.64, shown as partially paid; pay ₹9,688.64 by bank transfer → status **Paid**.
- [ ] Paying ₹1 more than the balance → 409 `AMOUNT_EXCEEDS_DUE`; paying a Draft → 409 `INVOICE_NOT_CONFIRMED`; as a customer → 403.
- [ ] Dashboard KPIs match a SQL cross-check on the seed (write the check queries in your PR description).
- [ ] Filters (date range, plan, customer) change every card and the chart.
- [ ] Every list and the dashboard respond in under 2 s at seed volume; numbers in the README.
- [ ] `npm run typecheck` passes; PR merged.

## 6. Demo script
- **Scene 4 (35 s):** open the invoice from scene 3 → Record payment ₹5,000 UPI → balance → second payment for the rest → Paid.
- **Scene 5 (35 s):** dashboard → revenue, outstanding, overdue with the list → change a filter (plan) → numbers update → show the network timing (< 2 s) → MRR and ARR as the extra KPI.
