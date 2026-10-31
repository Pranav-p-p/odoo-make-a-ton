# S1 · Commercial setup: your Phase 2 instructions

**Branch:** `s1-catalog` · **Owner:** MUZAMMIL C K · **Demo:** scene 1 (35 s)
**You deliver:** the admin can configure everything needed to sell a subscription.
**Requirement IDs:** CAT-1, CAT-2, CAT-3, CAT-4, CAT-5, CAT-6, DISC-1, DISC-2 · **Decisions:** D-4, D-11, D-21

Read first: `context.md` (§2, §3 D-4, D-11, D-21…D-23, §5), `docs/SPEC.md` (§2 configuration tables, §3 S1 endpoints, §5 S1 screens), `PHASE2.md` (shared rules).

---

## 1. What you own (edit only these)
```
src/app/app/products/**          src/app/api/v1/products/**
src/app/app/plans/**             src/app/api/v1/plans/**
src/app/app/templates/**         src/app/api/v1/taxes/**
src/app/app/discounts/**         src/app/api/v1/payment-terms/**
src/app/app/settings/**          src/app/api/v1/quote-templates/**
src/components/s1/**             src/app/api/v1/discount-rules/**
src/lib/validation/s1.ts         supabase/migrations/0100_s1_catalog.sql (only if you need SQL)
```
Tables you work with (already created by Core, RLS done): `taxes`, `payment_terms`, `products`, `product_variants`, `plans`, `quote_templates`, `quote_template_lines`, `discount_rules`, `discount_rule_products`.

**Others depend on you:** S2 reads plans, templates and products to create subscriptions; S3 reads taxes and discount rules to build invoices. Keep column names exactly as in SPEC §2.

## 2. Build order (one item at a time, PR after steps 2, 4 and 6)
1. **Taxes & payment terms** (`/app/settings`): two small tables with inline add / edit / archive. API `GET, POST /taxes`, `PATCH /taxes/:id`, same for `/payment-terms`. Rate 0–100, days ≥ 0, names unique.
2. **Products list + form** (`/app/products`, `/app/products/[id]`): search by name, type filter, "show archived" toggle. Form: name, type (service / software / addon / other), sales price, cost price, notes, default tax. Archive = `is_active = false` (never delete). **First PR here.**
3. **Variants table** on the product page: attribute, value, extra price, and a live "final price" column = sales price + extra. API `POST /products/:id/variants`, `PATCH|DELETE /products/:id/variants/:vid`. Seeded example: Brand = Odoo, +560.
4. **Plans** (`/app/plans`, `/app/plans/[id]`): name, price, billing period (daily / weekly / monthly / yearly), minimum quantity, available from / to, tax, and four switches, each with a one-line help text:
   - Auto-close: "Closes by itself on the expiry date."
   - Early close: "Can be closed before the expiry date."
   - Pause: "Can be paused and resumed."
   - Renew: "Can be extended by one more period."

   Show "Available now / Not yet available / No longer available" from the dates. **Second PR.**
5. **Quotation templates** (`/app/templates`, `/[id]`): name, plan, validity days, notes, product lines (product, variant, quantity). Show each line's effective unit price (product + variant extra) and the plan fee, read-only.
6. **Discount rules** (`/app/discounts`, `/[id]`): name, kind (percent / fixed), value, scope (specific products → product picker, or whole subscription), **one** condition (none / minimum purchase / minimum quantity + value), starts on, ends on, usage limit. Show **used / limit** and badges "Active", "Scheduled", "Expired", "Used up". **Third PR.**
7. **Read-only for staff:** staff see every S1 screen without save / archive buttons. Customers can only read products and plans (API), no S1 screens.

## 3. Rules you must enforce (server side, not just in the UI)
- Every write endpoint: role **admin** only → otherwise 403 `FORBIDDEN`. RLS repeats this.
- Validation with Zod in `src/lib/validation/s1.ts`, used by both the form and the API. Errors → 400 `VALIDATION_ERROR` with field messages shown under each field.
- Percent discount value ≤ 100. Condition value required unless condition = none. Ends on ≥ starts on. Scope = products needs at least one product.
- Plan available to ≥ available from; minimum quantity ≥ 1.
- Never delete anything referenced by a subscription or invoice: archive instead (if you add delete, return 409 `IN_USE`).
- **Don't add** per-customer discounts, coupon codes, multiple conditions, multiple taxes per line or fixed-amount taxes. They are out of scope (D-4, D-21).

## 4. Claude Code prompt (paste at the start of each session)
```
You are working on slice S1 (Commercial setup) of this repo.
Read context.md, docs/SPEC.md, PHASE2.md and docs/phase2/S1-catalog.md in full before writing code.
Only edit the files listed under "What you own". If you need anything else, stop and tell me.
Follow the decisions in context.md exactly; do not add features outside scope.
Use the shared API handler in src/lib/api, the UI kit in src/components/ui and the error codes in SPEC §3.
Next task: <paste one item from "Build order">. Show me a short plan first, then implement, then run npm run typecheck.
```

## 5. Done when (test each by hand, as admin and as staff)
- [ ] Create product "Demo Seat" (service, 500 / 100) with variants Brand Odoo +560 and Brand Generic +0; the final price shows 1,060 and 500.
- [ ] Create plan "Demo Monthly" (₹1,000, monthly, min qty 5, pause and renew on), tax GST 18% (demo).
- [ ] Create template "Demo · 12 Odoo seats" on that plan, 15 days, line Demo Seat / Odoo × 12.
- [ ] Create rule "10% from 10 seats": percent 10, products = Demo Seat, minimum quantity 10, usage limit 3.
- [ ] All of the above in under a minute in the UI.
- [ ] Logged in as staff: every save / archive is hidden, and calling the API directly returns 403.
- [ ] Wrong input (percent 150, negative price, end before start) shows a message under the field and the API returns 400.
- [ ] Lists page and search on the server; archived items hidden by default.
- [ ] `npm run typecheck` passes; PR merged into `main`.

## 6. Demo script (scene 1, 35 s)
"Admin sets up what Brightloop sells." Products → open the seeded product → show the Odoo variant adding 560 → Plans → open a plan, point at period, minimum quantity, availability and the four switches → Taxes → Discount rules → show "10% from 10 seats" with used / limit.
