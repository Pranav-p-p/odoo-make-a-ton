# docs/diff.md: questions and deviations

Log anything unclear or unfinished here instead of guessing (context.md §0.3, §9). One line each:

`QUESTION: <slice> · <requirement / D-n> · <question>` → the lead answers inline with `ANSWER:`
`DEVIATION: <slice> · <what differs from SPEC> · <why>` → needs the lead's approval
`UNFINISHED: <slice> · <what> · <impact on the demo>`

## Decided by the lead (31 Oct, 12:30)
- ANSWER: Problem statement is the source of truth; context.md v2 rewritten from it, extras removed.
- ANSWER: Auth = Supabase Auth (D-26).
- ANSWER: Expiry without auto-close → pause as "out of term"; only Renew or Close (D-9). Matches Zuora "Out of Term".
- ANSWER: Resume restarts billing from the resume date (D-8). Matches Chargebee and Stripe's default.
- ANSWER: No per-customer discount targeting; admin rules apply by scope and condition (D-21).
- ANSWER: Due date = generation date + payment-term days (D-16).
- ANSWER: One condition per discount rule: minimum purchase or minimum quantity (D-21).

## Deviations from SPEC (lead, Phase 1)
- DEVIATION: Core · subscriptions · added column `periods_billed` (periods invoiced since `billing_anchor`) so period n is always computed from the anchor (D-16). SPEC §2 updated.
- DEVIATION: Core · D-26/D-28 · signup confirmation and password-reset links are generated with the Supabase Auth admin API and emailed by our server (Resend), not by Supabase's SMTP. Same security (one-time Supabase token), and it works without SMTP setup. Needs `RESEND_API_KEY` for real emails; without it the dev server prints the link.
- DEVIATION: Core · D-16 · `run_billing_core(as_of, trigger, generated_on)` is internal; the public `run_billing` always uses today as the generation date. The seed uses the internal one so history invoices get realistic due dates (and some are overdue).

## Open
- (none)
