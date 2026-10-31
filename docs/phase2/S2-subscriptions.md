# S2 · Customers and subscriptions: your Phase 2 instructions

**Branch:** `s2-subscriptions` · **Owner:** ________ · **Demo:** scene 2 (40 s) + portal half of scene 6
**You deliver:** customers exist in the system; the team turns an offer into an active subscription and manages it through its whole life; customers manage their own in the portal.
**Requirement IDs:** AUTH-5, SUB-1, SUB-2, SUB-3, PORTAL-1 · **Decisions:** D-2, D-5…D-14, D-27

Read first: `context.md` (§2, §3 D-2 and D-5…D-14, §5 permission matrix), `docs/SPEC.md` (§2 subscriptions tables and function contracts, §3 S2 endpoints, §5 screens), `PHASE2.md`.

---

## 1. What you own (edit only these)
```
src/app/app/subscriptions/**     src/app/api/v1/subscriptions/**
src/app/app/customers/**         src/app/api/v1/customers/**
src/app/app/users/**             src/app/api/v1/admin/**
src/app/portal/** (pages, not portal/layout.tsx)
src/components/s2/**             src/lib/validation/s2.ts
supabase/migrations/0200_s2_lifecycle.sql
```
Tables: `customers`, `subscriptions`, `subscription_lines`, `subscription_status_history` (Core created them with RLS).

**Your SQL functions already exist** in `0200_s2_lifecycle.sql` with a working baseline. You finish them to the decisions. **Keep their names and parameters** (S3 calls `process_lifecycle`):
`create_subscription_from_template`, `sub_transition`, `sub_set_lines`, `sub_pause`, `sub_resume`, `sub_renew`, `sub_close`, `process_lifecycle`, `sub_allowed_actions`.

**Important:** status, pause and billing columns on `subscriptions` can only be changed inside these functions (a Core trigger refuses direct updates). Never `update subscriptions set status = …` from the API.

## 2. Build order (PR after steps 2, 4 and 6)
1. **Customers** (`/app/customers`, `/[id]`): list with server search (name, email), create / edit form (name, company, email, phone, address, GSTIN), detail page with this customer's subscriptions and invoices. API `GET, POST /customers`, `GET, PATCH /customers/:id`.
2. **Subscriptions list** (`/app/subscriptions`): from the `subscription_list` view; filters status, plan, customer, search by number; badges for status, "Quote expired", "Paused", "Expired, renewal needed". **First PR.**
3. **New subscription** (`/app/subscriptions/new`): two ways: **from template** (template + customer + start date + expiry + payment terms → `create_subscription_from_template`) or blank (plan + lines). Number `SUB-000123` is automatic.
4. **Subscription detail** (`/app/subscriptions/[id]`):
   - Header: customer, plan, dates, payment terms (editable only in Draft / Quotation).
   - Lines editor: product, variant, quantity, unit price (prefilled = product + variant extra), tax (prefilled = product default), amount. Saves through `PUT /subscriptions/:id/lines` → `sub_set_lines`. Totals come from the server.
   - Action buttons come **only** from `allowed_actions` in the API response.
   - Status timeline from the history table (who, when, note); the invoices list.

   **Second PR.**
5. **Lifecycle SQL to the decisions** (`0200_s2_lifecycle.sql`):
   - D-7: Draft → Quotation sets `quote_valid_until` (template days, else 30). Quotation → Confirmed is refused with `QUOTATION_EXPIRED`, `BELOW_MIN_QUANTITY` (D-2: **sum** of main product lines, add-ons excluded) or `PLAN_NOT_AVAILABLE`. Draft / Quotation / Confirmed → Closed (discard).
   - D-8: pause only if the plan allows it (`PLAN_NOT_PAUSABLE`); resume re-anchors billing at the resume date.
   - D-9: at expiry without auto-close, pause as `out_of_term`; resume is refused with `OUT_OF_TERM_RENEW_REQUIRED`; only Renew or Close.
   - D-10: renew = expiry + one plan period (`PLAN_NOT_RENEWABLE`); un-pauses out-of-term.
   - Close: early close only when the plan allows it (`PLAN_NOT_CLOSABLE`); admin always; out-of-term can always close.
   - D-13: line changes on Active apply from the next invoice and must still pass D-2.
6. **Users** (`/app/users`, admin only): list staff and admins, "Add staff" (name + email → invite email via Supabase Auth admin API with the service key on the server), change role, deactivate. Staff calling these get 403. **Third PR.**
7. **Portal** (`/portal/**`): My subscriptions (never Draft), detail with Pause / Resume / Renew / Close buttons **only when the plan allows** (from `allowed_actions`), My invoices (never Draft) and invoice detail with a Print link to `/print/invoices/[id]`, Profile (name, phone, address; email read-only).

## 3. Rules you must enforce
- Staff and admin create, edit and transition; customers only act on their own subscription and only pause / resume / renew / close when the plan allows.
- Another customer's id in the URL → **404**, not 403. Customers never see Drafts.
- Every status change writes a history row with who, when and a note.
- Errors come from the SQL functions as `CODE: detail`; the shared handler turns them into 409 with that code. Show the message in a toast.
- **Don't add:** a separate "paused" status, proration, customer quote acceptance or add-on toggles before everything above works (those are Could items).

## 4. Claude Code prompt
```
You are working on slice S2 (Customers and subscriptions) of this repo.
Read context.md, docs/SPEC.md, PHASE2.md and docs/phase2/S2-subscriptions.md in full before writing code.
Only edit the files listed under "What you own". If you need anything else, stop and tell me.
Status changes happen only inside the SQL lifecycle functions; keep their names and parameters.
Follow decisions D-2 and D-5…D-14 exactly; do not add features outside scope.
Next task: <paste one item from "Build order">. Show me a short plan first, then implement, then run npm run typecheck.
```

## 5. Done when (test each by hand)
- [ ] Staff: template "12 Odoo seats" + a customer → Draft → Quotation → Confirmed → Active; every step appears in the timeline with the user's name.
- [ ] A quotation whose `quote_valid_until` is in the past cannot be confirmed (409 `QUOTATION_EXPIRED`, badge "Quote expired").
- [ ] Lines below the plan's minimum quantity → 409 `BELOW_MIN_QUANTITY`; add-ons don't count towards the minimum.
- [ ] Pause on a plan without pause → `PLAN_NOT_PAUSABLE`. Pause, then resume: next invoice date = resume date.
- [ ] An out-of-term seeded subscription shows "Expired, renewal needed"; Resume is refused; Renew extends the expiry by one period and un-pauses it.
- [ ] Staff open `/app/users` → blocked; `POST /admin/users` as staff → 403. Admin adds a staff member and the invite email arrives.
- [ ] Demo customer in the portal sees only their own subscriptions and invoices, never Drafts; another id in the URL → 404.
- [ ] `npm run typecheck` passes; PR merged.

## 6. Demo script
- **Scene 2 (40 s):** "A sales rep starts from a template." New subscription → from template → pick customer → Draft (lines prefilled, Odoo price 1,060) → Send as quotation → Confirm → Activate → show the status timeline.
- **Scene 6, portal half:** log in as the demo customer → only their subscriptions → open one → buttons follow the plan's switches → change the id in the URL → not found.
