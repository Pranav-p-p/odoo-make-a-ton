# Phase 2: building your slice (13:45 → 16:00)

You own one slice end to end: its screens, API routes, SQL functions and checks. Read this file once for the shared rules, then work from **your slice's instruction file**: it has your files, build order, Claude Code prompt, done-when tests and demo script.

| Slice | Branch | Owner | Your instructions |
| --- | --- | --- | --- |
| S1 Commercial setup | `s1-catalog` | ________ | [`docs/phase2/S1-catalog.md`](docs/phase2/S1-catalog.md) |
| S2 Customers & subscriptions | `s2-subscriptions` | ________ | [`docs/phase2/S2-subscriptions.md`](docs/phase2/S2-subscriptions.md) |
| S3 Billing & invoices | `s3-billing` | ________ | [`docs/phase2/S3-billing.md`](docs/phase2/S3-billing.md) |
| S4 Payments & finance | `s4-finance` | ________ | [`docs/phase2/S4-finance.md`](docs/phase2/S4-finance.md) |

## Checkpoints (IST)
| Time | What must be true |
| --- | --- |
| 13:45 | Core is on `main`. You have pulled it, seeded, and the app runs locally |
| 14:45 | Your **first PR** is merged (even if small) |
| 15:30 | Your slice's "done when" checks pass on seeded data |
| 16:00 | Final PR merged. After this, bug fixes only, through the lead |
| 16:30 | Code freeze |

If you are going to miss a checkpoint, tell the lead **when you know**, not at the deadline.

---

## 1. Before 13:45 (while Core is being built)
1. Install Node 20+ and Git. Clone the repo if you haven't:
   ```bash
   git clone https://github.com/Pranav-p-p/odoo-make-a-ton.git
   cd odoo-make-a-ton
   ```
2. Read `context.md`, `docs/SPEC.md` and **your slice in `docs/TASKS.md`**. Know your requirement IDs and decisions (D-n).
3. Write your "done when" line as a checklist you will test against.
4. Sketch your screens and draft your SQL function bodies from the SPEC §2 contracts. Do not commit them yet.

## 2. At 13:45: get Core running
```bash
git checkout main
git pull
git checkout -b <your-branch>        # e.g. s3-billing
npm install
```
- Put the `.env.local` the lead sends you (privately) in the repo root. **Never commit it.**
- Then:
```bash
npm run seed        # only if the lead says your Supabase project needs it
npm run dev         # http://localhost:3000
npm run typecheck
```
- Log in with the demo accounts in `README.md` (admin, staff, customer) and open your screens. You will see starter pages: those are yours to build.

**Shared Supabase project:** everyone uses the same database. Do not reseed, truncate or drop tables without asking the lead; you would wipe everyone's data.

## 3. Your working loop
1. Pick the next unchecked item in your `docs/TASKS.md` section.
2. Build it inside **your folders only** (listed under "Owns" in `docs/TASKS.md`).
3. Run it in the browser on seeded data, as each role that matters (admin / staff / customer).
4. `npm run typecheck` must pass.
5. Commit and push your branch. Open a PR when a usable piece works (aim for one every 45–60 min).

```bash
git add -A
git commit -m "s3: run billing screen and result card"
git push -u origin <your-branch>
```
Then open a PR into `main` on GitHub, titled `S3: <what it does>`, and tell the lead.

**Before each PR, update from main:**
```bash
git fetch origin
git merge origin/main
npm run typecheck
```

## 4. Rules
- **Stay in your folders.** Need a change in Core (schema, auth, shell, shared types, `src/lib/api`) or another slice? Ask its owner or the lead. Don't edit it yourself.
- **Database changes go only in your SQL file** (`0100_s1_…`, `0200_s2_…`, `0300_s3_…`, `0400_s4_…`). Use `create or replace function`. Keep the signatures in SPEC §2: other slices call them.
- **Don't invent requirements.** The PS is the source of truth, then context.md decisions, then SPEC, then TASKS. If something is unclear, add a line to `docs/diff.md` and keep building on the SPEC default:
  ```
  QUESTION: S2 · D-9 · Can a customer close an out-of-term subscription if the plan disallows early close?
  ```
- **Every rule is enforced on the server** (API + SQL/RLS). Hiding a button is not enough.
- **Errors use the SPEC §3 format and codes.** Don't make up new codes without adding them to `docs/diff.md`.
- **Money is calculated in SQL**, never in the browser. The UI only displays numbers from the server.
- Never commit `.env.local`, keys or `node_modules`.

## 5. Using Claude Code on your slice
Start each session in the repo root with this prompt (replace the slice):

```
You are working on slice S3 (Billing & invoices) of this repo.
Read context.md, docs/SPEC.md and the S3 section of docs/TASKS.md in full before writing code.
Rules:
- Only edit files listed under "Owns" for S3. If you need anything outside them, stop and tell me.
- The problem statement and context.md decisions win over your own ideas. Do not add features outside scope.
- Keep SQL function signatures exactly as in SPEC §2. Use the error codes in SPEC §3.
- After each change, run `npm run typecheck`.
Start with the first unchecked item in the S3 checklist. Show me a short plan first.
```

Tips:
- Give it one checklist item at a time, not the whole slice.
- Check its work in the browser yourself. "It compiles" is not "it works".
- If it wants to change schema or Core files, say no and log it in `docs/diff.md`.

## 6. Done means
- Every item in your `docs/TASKS.md` checklist works on seeded data.
- Your **"done when"** line is checked by hand, including the refusal cases (wrong role gets 403, invalid input shows an error).
- `npm run typecheck` passes and your PR is merged into `main`.
- You can show your demo scene (docs/TASKS.md) in the stated time without hesitating.

## 7. If you're stuck
| Problem | Do this |
| --- | --- |
| Stuck for more than 15 min | Tell the lead. Don't sink an hour |
| A contract function from another slice behaves wrong | Use Core's baseline, log it in `docs/diff.md`, tell its owner |
| Merge conflict outside your folders | Stop, don't resolve it yourself, call the lead |
| Supabase error `P0001` with a code | That's a business rule refusing the action (expected); show it as a 409 message |
| Seed data missing for your case | Ask the lead; don't insert data directly into the shared database |
| Running out of time | Finish the Must items in your checklist; skip Should/Could and note it as `UNFINISHED:` in `docs/diff.md` |
