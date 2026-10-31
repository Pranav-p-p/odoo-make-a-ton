/**
 * Golden-path smoke test (lead-owned): `npm run smoke`               → auth, roles, RLS, reports, speed
 *                                       `npm run smoke -- --billing`  → also the full billing path (SPEC §1)
 *
 * Talks to Supabase as the real demo users (anon key + password sign-in), so Row Level Security and the
 * SQL business functions are exercised exactly as the API uses them. Needs `npm run seed` first.
 *
 * --billing creates a subscription and RUNS BILLING FOR TODAY, which also bills the ~300 seeded
 * subscriptions due today. Use it before the final reseed, never right before the demo.
 * Set APP_URL to also check the running Next.js API (signup password rule, 401 without a session).
 */
import { config } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.APP_URL;
const BILLING = process.argv.includes('--billing');
if (!url || !anon) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

let failed = 0;
function check(name: string, ok: boolean, info = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${info ? `  (${info})` : ''}`);
  if (!ok) failed++;
}
async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}
const code = (e: { message?: string } | null) => (e?.message ?? '').split(':')[0];

async function main() {
  const admin = await signIn('admin@brightloop.test', 'Admin@12345');
  const staff = await signIn('staff@brightloop.test', 'Staff@12345');
  const cust = await signIn('shop@corner.test', 'Customer@123');
  check('AUTH-4 three roles sign in', true);

  // ---- Roles and RLS ----
  const me = await cust.rpc('my_customer_id');
  check('AUTH-1/D-27 customer login is linked to a customer record', !!me.data, String(me.data));
  const subs = await cust.from('subscriptions').select('id, customer_id, status');
  check('PORTAL-1 customer sees only own subscriptions, never Draft',
    !subs.error && (subs.data ?? []).every((s) => s.customer_id === me.data && s.status !== 'draft'), `${subs.data?.length ?? 0} rows`);
  const invs = await cust.from('invoices').select('id, customer_id, status');
  check('PORTAL-1 customer sees only own invoices, never Draft',
    !invs.error && (invs.data ?? []).every((i) => i.customer_id === me.data && i.status !== 'draft'), `${invs.data?.length ?? 0} rows`);
  const custBill = await cust.rpc('run_billing', {});
  check('AUTH-4 customer cannot run billing', code(custBill.error) === 'FORBIDDEN', code(custBill.error));
  const staffWrite = await staff.from('taxes').insert({ name: `smoke-${Date.now()}`, rate_percent: 1 }).select();
  check('CAT-5 staff cannot create taxes (admin only)', !!staffWrite.error || (staffWrite.data ?? []).length === 0);
  const adminWrite = await admin.from('taxes').insert({ name: `Smoke tax ${Date.now()}`, rate_percent: 1, is_active: false }).select().single();
  check('CAT-5 admin can create taxes', !adminWrite.error, adminWrite.error?.message);
  const custTaxes = await cust.from('taxes').select('id');
  check('§5 customers cannot read taxes', (custTaxes.data ?? []).length === 0);
  const oneQuote = await staff.from('subscriptions').select('id').eq('status', 'quotation').limit(1).single();
  const directStatus = await staff.from('subscriptions').update({ status: 'active' }).eq('id', oneQuote.data?.id ?? '').select();
  check('§9.4 status cannot be changed outside lifecycle functions', !!directStatus.error, code(directStatus.error));

  // ---- Reports and speed (REP-1, REP-2, NFR-1) ----
  const today = (await staff.rpc('today_ist')).data as string;
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  let t = Date.now();
  const sum = await staff.rpc('report_summary', { p_from: yearAgo, p_to: today });
  check('REP-1/REP-2 summary with MRR', !sum.error && Number(sum.data?.mrr) > 0, `${Date.now() - t} ms, MRR ${sum.data?.mrr}`);
  check('NFR-1 summary under 2 s', Date.now() - t < 2000);
  t = Date.now();
  const list = await staff.from('invoice_list').select('*', { count: 'exact' }).eq('is_overdue', true).order('due_date').range(0, 19);
  check('PAY-2 overdue invoice list', !list.error && (list.count ?? 0) > 0, `${Date.now() - t} ms, ${list.count} overdue`);
  t = Date.now();
  const sl = await staff.from('subscription_list').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(0, 19);
  check('NFR-1 subscription list page under 2 s', !sl.error && Date.now() - t < 2000, `${Date.now() - t} ms, ${sl.count} subscriptions`);
  const custReport = await cust.rpc('report_summary', { p_from: yearAgo, p_to: today });
  check('REP-1 customers cannot read reports', code(custReport.error) === 'FORBIDDEN');

  // ---- Golden path with billing (SPEC §1 steps 2–4) ----
  if (BILLING) {
    const tpl = await staff.from('quote_templates').select('id').eq('name', 'Business · 12 Odoo CRM seats').single();
    const someCustomer = await staff.from('customers').select('id').eq('email', 'customer7@example.test').single();
    const term = await staff.from('payment_terms').select('id').eq('name', 'Net 15').single();
    const created = await staff.rpc('create_subscription_from_template', {
      p_template_id: tpl.data!.id, p_customer_id: someCustomer.data!.id, p_start: today, p_payment_term_id: term.data!.id,
    });
    check('SUB-1 quotation from template', !created.error, created.error?.message);
    const id = created.data!.id as string;
    for (const to of ['quotation', 'confirmed', 'active']) {
      const r = await staff.rpc('sub_transition', { p_id: id, p_to: to });
      check(`SUB-3 → ${to}`, !r.error, r.error?.message);
    }
    t = Date.now();
    const run1 = await staff.rpc('run_billing', {});
    check('BILL-1/BILL-4 billing run', !run1.error && run1.data.failed_count === 0,
      `${run1.data?.created_count} created, ${run1.data?.failed_count} failed, ${Date.now() - t} ms`);
    const run2 = await staff.rpc('run_billing', {});
    check('BILL-4 second run creates 0', !run2.error && run2.data.created_count === 0);
    const inv = await staff.from('invoices').select('*').eq('subscription_id', id).single();
    check('BILL-2/DISC-3 invoice total = 14,688.64', Number(inv.data?.total) === 14688.64,
      `total ${inv.data?.total}, discount ${inv.data?.discount_name}`);
    const conf = await staff.rpc('invoice_confirm', { p_id: inv.data!.id });
    check('BILL-3 confirm', !conf.error && conf.data.status === 'confirmed');
    const p1 = await staff.rpc('record_payment', { p_invoice_id: inv.data!.id, p_amount: 5000, p_method: 'upi' });
    check('PAY-1 first payment, balance shown', !p1.error && Number(p1.data.amount_due) === 9688.64, `due ${p1.data?.amount_due}`);
    const over = await staff.rpc('record_payment', { p_invoice_id: inv.data!.id, p_amount: 99999, p_method: 'cash' });
    check('D-24 overpayment refused', code(over.error) === 'AMOUNT_EXCEEDS_DUE');
    const p2 = await staff.rpc('record_payment', { p_invoice_id: inv.data!.id, p_amount: 9688.64, p_method: 'bank_transfer' });
    check('PAY-1 second payment → Paid', !p2.error && p2.data.status === 'paid');
  } else {
    console.log('· billing path skipped (run with --billing to include it)');
  }

  // ---- Next.js API (optional) ----
  if (appUrl) {
    const weak = await fetch(`${appUrl}/api/v1/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Weak', email: `weak${Date.now()}@example.test`, password: 'password1' }),
    });
    check('AUTH-2 server refuses a weak password', weak.status === 400, String(weak.status));
    const anonMe = await fetch(`${appUrl}/api/v1/me`);
    check('AUTH-4 API answers 401 without a session', anonMe.status === 401, String(anonMe.status));
  }

  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll smoke checks passed');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
