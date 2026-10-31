/**
 * Demo data (SPEC §6): `npm run seed`            → adds data if the database is empty
 *                      `npm run seed -- --reset` → wipes business data first, then seeds
 *
 * Needs .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and every migration applied.
 * The database is SHARED by the team: only the lead runs --reset, and tells everyone first.
 *
 * Steps: logins → catalog → ~1,500 customers and 5,000 subscriptions → history billing one week per call
 * (each call is its own transaction, ~1–2 s) up to yesterday → confirm, pay, pause → ~300 due today.
 * The scheduler stays off (app_settings.scheduler_enabled = false).
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: ['.env.local', '.env'], quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const RESET = process.argv.includes('--reset');

export const DEMO_USERS = [
  { email: 'admin@brightloop.test', password: 'Admin@12345', full_name: 'Asha Admin', role: 'admin' },
  { email: 'staff@brightloop.test', password: 'Staff@12345', full_name: 'Sam Staff', role: 'staff' },
  { email: 'staff2@brightloop.test', password: 'Staff@12345', full_name: 'Sara Staff', role: 'staff' },
  { email: 'shop@corner.test', password: 'Customer@123', full_name: 'Corner Shop', role: 'customer' },
] as const;

function fail(step: string, error: { message: string } | null | undefined): never {
  console.error(`✗ ${step}: ${error?.message ?? 'unknown error'}`);
  process.exit(1);
}

async function ensureUser(u: (typeof DEMO_USERS)[number]) {
  const appMeta = u.role === 'customer' ? {} : { role: u.role };
  const { error } = await db.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    app_metadata: appMeta,
    user_metadata: { full_name: u.full_name },
  });
  if (error && error.code !== 'email_exists' && !/already/i.test(error.message)) fail(`create ${u.email}`, error);
  const { data: p, error: e2 } = await db.from('profiles').select('id').eq('email', u.email).single();
  if (e2 || !p) fail(`find profile ${u.email}`, e2);
  if (error) {
    const { error: e3 } = await db.auth.admin.updateUserById(p.id, { password: u.password, app_metadata: appMeta, email_confirm: true });
    if (e3) fail(`update ${u.email}`, e3);
  }
  const { error: e4 } = await db.from('profiles').update({ role: u.role, full_name: u.full_name, is_active: true }).eq('id', p.id);
  if (e4) fail(`profile ${u.email}`, e4);
  if (u.role === 'customer') {
    // make sure the demo customer record exists and is linked (D-27; the email is verified)
    await db.from('customers').upsert({ email: u.email, name: u.full_name, user_id: p.id }, { onConflict: 'email' });
  }
  console.log(`✓ login ${u.email} (${u.role})`);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(new Date(`${s}T00:00:00Z`).getTime() + n * 86400000));

async function rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) fail(fn, error);
  return data as T;
}

async function main() {
  const t0 = Date.now();
  if (RESET) {
    await rpc('seed_reset');
    console.log('✓ business data wiped (--reset)');
  }
  for (const u of DEMO_USERS) await ensureUser(u);

  console.log('✓ catalog', JSON.stringify(await rpc('seed_catalog')));
  const subs = await rpc<Record<string, unknown>>('seed_subscriptions', { p_customers: 1500, p_subs: 5000, p_aligned: 220 });
  console.log('✓ customers and subscriptions', JSON.stringify(subs));
  if (subs.skipped) {
    console.log('  (database already seeded; use --reset to rebuild)');
    return;
  }

  // History billing: one call per week, as nightly runs would have done.
  const today = (await rpc<string>('today_ist')).slice(0, 10);
  const yesterday = addDays(today, -1);
  const { data: oldest } = await db.from('subscriptions').select('start_date').not('billing_anchor', 'is', null).order('start_date').limit(1).maybeSingle();
  let d = oldest?.start_date ?? yesterday;
  let created = 0;
  while (d < yesterday) {
    const r = await rpc<{ created: number }>('seed_bill_until', { p_as_of: d });
    created += r.created;
    process.stdout.write(`\r  billing history… as of ${d} · ${created} invoices`);
    d = addDays(d, 7);
  }
  created += (await rpc<{ created: number }>('seed_bill_until', { p_as_of: yesterday })).created;
  console.log(`\n✓ history billing: ${created} invoices`);

  console.log('✓ finish', JSON.stringify(await rpc('seed_finish', { p_paid_ratio: 0.8 })));
  console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)} s. Scheduler is OFF. Sign in with:`);
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(24)} ${u.password}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
