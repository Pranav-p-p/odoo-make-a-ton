# Brightloop: Subscription Management System

One platform for the whole life of a subscription: products and plans → quotations → subscriptions → automatic invoices → payments → revenue reporting, for admin, staff and customers (portal).

Make-A-Ton 9.0 (Odoo x CUSAT). Problem statement: [`docs/problem-statement.md`](docs/problem-statement.md).

**Read in this order:** [`context.md`](context.md) (requirements and decisions) → [`docs/SPEC.md`](docs/SPEC.md) (schema, API, screens) → [`docs/TASKS.md`](docs/TASKS.md) (the four slices) → [`PHASE2.md`](PHASE2.md) and your file in [`docs/phase2/`](docs/phase2/).

## Status

| Part | State |
| --- | --- |
| Core: schema, RLS, lifecycle guard, views | ✅ done, tested locally |
| Core: auth (signup with AUTH-2, login, forgot/reset, callback), session, role guards | ✅ done |
| Core: app shell, nav per role, UI kit, starter page for every screen | ✅ done |
| Core: shared Zod schemas per slice, typed API client, SWR hooks, error format | ✅ done |
| Contract functions (lifecycle, billing, payments, reports) with working baselines | ✅ done, tested locally |
| Seed (5,000 subscriptions, ~22,000 invoices, ~300 due today) and smoke test | ✅ done |
| S1–S4 screens and API routes | Phase 2 (see `docs/phase2/`) |

## Stack
Next.js 15 (App Router, TypeScript) · Tailwind 4 · SWR · Zod · Supabase (Postgres, Auth, RLS, `pg_cron`) · Resend · Vercel. Business rules that touch money or state are Postgres functions; the API validates, checks roles and calls them (D-0).

## Getting started (each teammate)
```bash
git checkout main && git pull
git checkout -b <your-branch>          # s1-catalog | s2-subscriptions | s3-billing | s4-finance
npm install
# put the .env.local the lead sends you in the repo root (never commit it)
npm run dev                            # http://localhost:3000
npm run typecheck
```

### Demo logins (after the seed)
| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@brightloop.test | Admin@12345 |
| Staff | staff@brightloop.test | Staff@12345 |
| Staff | staff2@brightloop.test | Staff@12345 |
| Customer | shop@corner.test | Customer@123 |

## Setting up Supabase (lead, once)
1. Create a project (region Mumbai). Copy the URL, anon key and service-role key into `.env.local` (template: `.env.example`).
2. **Auth → Providers → Email:** turn **off** "Allow new users to sign up" (our `/api/v1/auth/signup` creates accounts with the service key after checking AUTH-2); keep "Confirm email" on; set the minimum password length to 9.
3. **Auth → URL configuration:** Site URL = `APP_URL`; add `http://localhost:3000/**` and the Vercel URL to the redirect list.
4. **Database → Extensions:** enable `pg_cron` (the billing migration schedules the job; it only runs when `app_settings.scheduler_enabled` is true).
5. **SQL editor:** run the migrations in order: `0001_core_schema` → `0002_core_security` → `0003_core_views` → `0100_s1_catalog` → `0200_s2_lifecycle` → `0300_s3_billing` → `0400_s4_finance` → `0900_seed_helpers`. (Or `supabase db push` with the CLI.)
6. `npm run seed` (about a minute). Keep the scheduler **off** until after the demo (D-19).
7. `npm run smoke` → all green.

The database is **shared**. Only the lead runs `npm run seed -- --reset` (wipes business data and reseeds) and tells everyone first.

## Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | TypeScript, must pass before every PR |
| `npm run seed` | demo logins + SPEC §6 data; `-- --reset` to rebuild |
| `npm run smoke` | golden-path checks against Supabase as the real users (roles, RLS, reports, speed) |
| `npm run smoke -- --billing` | also runs billing for today and the invoice/payment path. **Bills the ~300 due-today subscriptions**, so run it before the final reseed, not before the demo |

## Testing the database locally (no Supabase needed)
Plain PostgreSQL 16 plus a small stub of Supabase's `auth` schema:
```bash
createdb bl
psql -d bl -f supabase/tests/00_local_postgres_stub.sql
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d bl -f "$f"; done
# seed with SQL (same functions the seed script calls), then:
psql -d bl -f supabase/tests/20_core_checks.sql      # business + security checks
```
Results on the seeded data (5,000 subscriptions, 22,177 invoices, 18,997 payments):

| Check | Result |
| --- | --- |
| Billing run on the due-today subscriptions | 380 created, 0 failed; second run 0 created |
| Template "12 Odoo CRM seats" → Active → invoice | ₹13,720 − ₹1,272 (10% from 10 seats) + ₹2,240.64 tax = **₹14,688.64** |
| Month-end clamp | 31 Jan → 28 Feb → 31 Mar → 30 Apr |
| Two payments → Paid; overpayment refused | ✅ |
| Expired quote, out-of-term resume, customer isolation, customer billing | refused as specified |
| anon / untrusted callers on business and seed functions | no access |
| Subscription list page, invoice overdue page, summary, revenue, overdue buckets | 4–50 ms each |

## Repository layout
```
context.md, PHASE2.md        shared context and Phase 2 rules
docs/                        problem statement, SPEC, TASKS, diff (questions/deviations), phase2/ per-slice instructions
supabase/migrations/         0001–0003 Core · 0100 S1 · 0200 S2 · 0300 S3 · 0400 S4 · 0900 seed helpers
supabase/tests/              local Postgres stub + checks
scripts/seed.ts, smoke.ts    lead-owned
src/app/(auth)/, auth/       Core: login, signup, forgot/reset, callback
src/app/app/                 console (admin, staff): each screen owned by a slice
src/app/portal/              customer portal (S2)
src/app/print/               printable invoice (S3)
src/app/api/v1/              auth + me (Core); slice routes added in Phase 2
src/components/ui, shell     Core UI kit, shell, nav, starter page
src/lib/                     Core: api handler + errors, supabase clients, session, types, validation/{auth,s1,s2,s3,s4}.ts, client api + hooks
```

## Out of scope (stated)
Real payment gateway, proration, refunds and credit notes, multi-currency, dunning, CSV import/export (context.md §7).
