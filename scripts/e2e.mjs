/**
 * Full-workflow test through the running Next.js API: `npm run e2e` (server on APP_URL or localhost:3000).
 *
 * Walks the demo path as admin, staff and customer: catalogue → quotation from template → Active →
 * billing run → confirm/send/print → two payments → reports → users → portal, plus role and page guards.
 *
 * WRITES to the shared database: it creates E2E-named records and RUNS BILLING FOR TODAY, which also
 * bills every subscription due today. Run it before the final reseed, not right before the demo.
 */
const BASE = process.env.BASE ?? 'http://localhost:3000';
const TS = Date.now().toString().slice(-6);
let failed = 0;
const log = [];
function check(name, ok, info = '') {
  const line = `${ok ? '✓' : '✗'} ${name}${info ? `  (${info})` : ''}`;
  console.log(line);
  if (!ok) failed++;
}
const short = (j) => JSON.stringify(j)?.slice(0, 300);

class Client {
  constructor(name) { this.name = name; this.token = null; this.cookies = {}; }
  async call(method, path, body) {
    const t = Date.now();
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.cookies[kv.slice(0, i)] = kv.slice(i + 1); }
    const json = await res.json().catch(() => null);
    return { status: res.status, json, ms: Date.now() - t };
  }
  get(p) { return this.call('GET', p); }
  post(p, b = {}) { return this.call('POST', p, b); }
  patch(p, b) { return this.call('PATCH', p, b); }
  put(p, b) { return this.call('PUT', p, b); }
  del(p) { return this.call('DELETE', p); }
  async login(email, password) {
    const r = await this.post('/auth/login', { email, password });
    this.token = r.json?.session?.access_token;
    return r;
  }
  async page(path) {
    const cookie = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    const html = res.status === 200 ? await res.text() : '';
    return { status: res.status, location: res.headers.get('location'), html };
  }
}
const ok2 = (r) => r.status >= 200 && r.status < 300;

async function main() {
  const anon = new Client('anon');
  const admin = new Client('admin'), staff = new Client('staff'), cust = new Client('customer');

  // ---------- Auth ----------
  console.log('\n== Auth ==');
  check('401 without session', (await anon.get('/me')).status === 401);
  const bad = await anon.post('/auth/login', { email: 'admin@brightloop.test', password: 'wrong-password' });
  check('wrong password refused', bad.status === 401, bad.json?.error?.code);
  for (const [c, e, p] of [[admin, 'admin@brightloop.test', 'Admin@12345'], [staff, 'staff@brightloop.test', 'Staff@12345'], [cust, 'shop@corner.test', 'Customer@123']]) {
    const r = await c.login(e, p);
    check(`login ${c.name}`, r.status === 200 && !!c.token, `${r.status} ${r.json?.user?.role ?? short(r.json)}`);
  }
  const me = await cust.get('/me');
  check('customer /me has customer_id', !!me.json?.customer_id, me.json?.role);
  const weak = await anon.post('/auth/signup', { full_name: 'Weak Pw', email: `weak${TS}@example.test`, password: 'password1' });
  check('signup refuses weak password', weak.status === 400, short(weak.json?.error?.details));
  const eight = await anon.post('/auth/signup', { full_name: 'Eight', email: `eight${TS}@example.test`, password: 'Abcdef@1' });
  check('signup refuses exactly 8 chars (must be > 8)', eight.status === 400);
  const su = await anon.post('/auth/signup', { full_name: `E2E Signup ${TS}`, email: `e2e.signup${TS}@example.test`, password: 'Brightloop@2026' });
  check('signup with strong password', ok2(su), `${su.status} ${short(su.json)}`);
  const dup = await anon.post('/auth/signup', { full_name: 'Dup', email: 'shop@corner.test', password: 'Brightloop@2026' });
  check('signup refuses an existing email', dup.status === 409, `${dup.status} ${dup.json?.error?.code}`);
  const fp = await anon.post('/auth/forgot-password', { email: 'nobody-here@example.test' });
  check('forgot password answers the same for unknown email', ok2(fp), `${fp.status} ${short(fp.json)}`);

  // ---------- S1 catalog (admin) ----------
  console.log('\n== S1 Catalog ==');
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const tax = await admin.post('/taxes', { name: `E2E GST 18 ${TS}`, rate_percent: 18 });
  check('admin creates tax', ok2(tax), `${tax.status} ${short(tax.json?.error ?? tax.json?.id)}`);
  const taxId = tax.json?.id;
  check('staff cannot create tax', (await staff.post('/taxes', { name: `nope ${TS}`, rate_percent: 5 })).status === 403);
  const taxes = await staff.get('/taxes?page=1&page_size=50');
  check('staff lists taxes', ok2(taxes) && Array.isArray(taxes.json?.data), `${taxes.status} total ${taxes.json?.total}`);
  check('customer cannot list taxes', (await cust.get('/taxes')).status === 403, String((await cust.get('/taxes')).status));
  const tp = await admin.patch(`/taxes/${taxId}`, { name: `E2E GST 18 ${TS}`, rate_percent: 18, is_active: true });
  check('admin edits tax', ok2(tp), `${tp.status} ${short(tp.json?.error)}`);
  const term = await admin.post('/payment-terms', { name: `E2E Net 10 ${TS}`, days: 10 });
  check('admin creates payment term', ok2(term), `${term.status} ${short(term.json?.error)}`);
  const termId = term.json?.id;

  const prod = await admin.post('/products', {
    name: `E2E CRM Suite ${TS}`, type: 'software', sales_price: 1000, cost_price: 400, notes: 'e2e test product', default_tax_id: taxId,
    variants: [{ attribute: 'Brand', value: 'Odoo', extra_price: 560 }, { attribute: 'Brand', value: 'Generic', extra_price: 0 }],
  });
  check('admin creates product with variants', ok2(prod), `${prod.status} ${short(prod.json?.error ?? prod.json?.id)}`);
  const prodId = prod.json?.id;
  const pd = await staff.get(`/products/${prodId}`);
  const variants = pd.json?.variants ?? [];
  const odoo = variants.find((v) => v.value === 'Odoo');
  check('product detail has variants (Odoo +560)', ok2(pd) && Number(odoo?.extra_price) === 560, `${pd.status} ${variants.length} variants`);
  const nv = await admin.post(`/products/${prodId}/variants`, { attribute: 'Edition', value: 'Pro', extra_price: 200 });
  check('admin adds variant', ok2(nv), `${nv.status} ${short(nv.json?.error)}`);
  if (nv.json?.id) {
    const pv = await admin.patch(`/products/${prodId}/variants/${nv.json.id}`, { attribute: 'Edition', value: 'Pro', extra_price: 250 });
    check('admin edits variant', ok2(pv), `${pv.status} ${short(pv.json?.error)}`);
    const dv = await admin.del(`/products/${prodId}/variants/${nv.json.id}`);
    check('admin deletes variant', ok2(dv), `${dv.status} ${short(dv.json?.error)}`);
  }
  check('staff cannot create product', (await staff.post('/products', { name: 'x', sales_price: 1 })).status === 403);
  const pl = await staff.get(`/products?q=${encodeURIComponent('E2E CRM')}&page=1&page_size=20`);
  check('product search', ok2(pl) && pl.json?.data?.some((p) => p.id === prodId), `${pl.status} ${pl.json?.total}`);
  const pe = await admin.patch(`/products/${prodId}`, { name: `E2E CRM Suite ${TS}`, sales_price: 1000, notes: 'edited' });
  check('admin edits product', ok2(pe), `${pe.status} ${short(pe.json?.error)}`);

  const plan = await admin.post('/plans', {
    name: `E2E Monthly ${TS}`, price: 0, billing_period: 'monthly', min_quantity: 1, available_from: today,
    auto_close: false, allow_early_close: true, allow_pause: true, allow_renew: true, tax_id: taxId,
  });
  check('admin creates plan', ok2(plan), `${plan.status} ${short(plan.json?.error ?? plan.json?.id)}`);
  const planId = plan.json?.id;
  const plg = await staff.get(`/plans/${planId}`);
  check('plan detail', ok2(plg), String(plg.status));
  const plp = await admin.patch(`/plans/${planId}`, { allow_pause: true });
  check('admin edits plan', ok2(plp), `${plp.status} ${short(plp.json?.error)}`);
  const plans = await cust.get('/plans');
  check('customer can read plans', ok2(plans), String(plans.status));

  const tpl = await admin.post('/quote-templates', { name: `E2E 12 seats ${TS}`, plan_id: planId, validity_days: 30, lines: [{ product_id: prodId, variant_id: odoo?.id ?? null, quantity: 12 }] });
  check('admin creates quotation template', ok2(tpl), `${tpl.status} ${short(tpl.json?.error ?? tpl.json?.id)}`);
  const tplId = tpl.json?.id;
  const tg = await staff.get(`/quote-templates/${tplId}`);
  check('template detail with lines', ok2(tg) && (tg.json?.lines?.length ?? 0) === 1, `${tg.status} ${short(tg.json?.error)}`);
  const tps = await staff.get('/quote-templates?page=1&page_size=20');
  check('template list', ok2(tps), `${tps.status} ${tps.json?.total}`);

  const disc = await admin.post('/discount-rules', {
    name: `E2E 10% from 10 seats ${TS}`, kind: 'percent', value: 10, scope: 'products', product_ids: [prodId],
    condition: 'min_quantity', condition_value: 10, starts_on: today, usage_limit: 5,
  });
  check('admin creates discount rule', ok2(disc), `${disc.status} ${short(disc.json?.error ?? disc.json?.id)}`);
  const discId = disc.json?.id;
  check('staff cannot create discount', (await staff.post('/discount-rules', { name: 'x', kind: 'fixed', value: 1, scope: 'subscription', starts_on: today })).status === 403);
  const dg = await staff.get(`/discount-rules/${discId}`);
  check('discount detail', ok2(dg), `${dg.status} ${short(dg.json?.error)}`);
  const dl = await staff.get('/discount-rules?page=1&page_size=50');
  check('discount list', ok2(dl), `${dl.status} ${dl.json?.total}`);

  // ---------- S2 customers & subscriptions (staff) ----------
  console.log('\n== S2 Subscriptions ==');
  const c = await staff.post('/customers', { name: `E2E Customer ${TS}`, company_name: 'E2E Pvt Ltd', email: `e2e.customer${TS}@example.test`, phone: '9999999999', address: 'Kochi', gstin: '' });
  check('staff creates customer', ok2(c), `${c.status} ${short(c.json?.error ?? c.json?.id)}`);
  const custId = c.json?.id;
  const cdup = await staff.post('/customers', { name: 'Dup', email: `e2e.customer${TS}@example.test` });
  check('duplicate customer email refused', cdup.status === 409, `${cdup.status} ${cdup.json?.error?.code}`);
  const cl = await staff.get(`/customers?q=${encodeURIComponent(`E2E Customer ${TS}`)}`);
  check('customer search', ok2(cl) && cl.json?.total >= 1, `${cl.status} ${cl.json?.total} ${short(cl.json?.error)}`);
  const cg = await staff.get(`/customers/${custId}`);
  check('customer detail', ok2(cg), `${cg.status} ${short(cg.json?.error)}`);
  const cpatch = await staff.patch(`/customers/${custId}`, { phone: '8888888888' });
  check('staff edits customer', ok2(cpatch), `${cpatch.status} ${short(cpatch.json?.error)}`);
  const opts = await staff.get('/subscriptions/options');
  check('subscription form options', ok2(opts), `${opts.status} keys ${Object.keys(opts.json ?? {}).join(',')}`);

  const s = await staff.post('/subscriptions', { from_template_id: tplId, customer_id: custId, start_date: today, payment_term_id: termId });
  check('quotation from template', ok2(s), `${s.status} ${short(s.json?.error ?? s.json?.id)}`);
  const subId = s.json?.id;
  let sd = await staff.get(`/subscriptions/${subId}`);
  check('subscription detail: Draft with number, lines, actions', ok2(sd) && sd.json?.subscription?.status === 'draft' && !!sd.json?.subscription?.number && sd.json?.lines?.length === 1,
    `${sd.status} ${sd.json?.subscription?.number} ${sd.json?.subscription?.status} actions=${short(sd.json?.allowed_actions)}`);
  const hp = await staff.patch(`/subscriptions/${subId}`, { notes: 'E2E header edit' });
  check('edit header in Draft', ok2(hp), `${hp.status} ${short(hp.json?.error)}`);
  const line = sd.json?.lines?.[0];
  const lp = await staff.put(`/subscriptions/${subId}/lines`, { lines: [{ product_id: prodId, variant_id: line?.variant_id ?? odoo?.id, quantity: 12, unit_price: line?.unit_price ?? null, tax_id: line?.tax_id ?? taxId }] });
  check('replace lines in Draft', ok2(lp), `${lp.status} ${short(lp.json?.error)}`);
  for (const to of ['quotation', 'confirmed', 'active']) {
    const r = await staff.post(`/subscriptions/${subId}/transition`, { to, note: `e2e → ${to}` });
    check(`transition → ${to}`, ok2(r), `${r.status} ${short(r.json?.error ?? r.json?.status)}`);
  }
  const back = await staff.post(`/subscriptions/${subId}/transition`, { to: 'quotation' });
  check('invalid transition refused', back.status === 409, `${back.status} ${back.json?.error?.code}`);
  sd = await staff.get(`/subscriptions/${subId}`);
  check('detail shows Active + history', sd.json?.subscription?.status === 'active' && (sd.json?.history?.length ?? 0) >= 3, `${sd.json?.subscription?.status} history ${sd.json?.history?.length} next ${sd.json?.subscription?.next_invoice_date}`);

  check('active subscription offers edit_lines, pause, close', ['edit_lines', 'pause', 'close'].every((a) => sd.json?.allowed_actions?.includes(a)), short(sd.json?.allowed_actions));
  const s3 = await staff.post('/subscriptions', { customer_id: custId, plan_id: planId, start_date: today, expiry_date: new Date(Date.now() + 60 * 86400e3).toISOString().slice(0, 10), lines: [{ product_id: prodId, quantity: 1 }] });
  for (const to of ['quotation', 'confirmed', 'active']) await staff.post(`/subscriptions/${s3.json?.id}/transition`, { to });
  const s3d = await staff.get(`/subscriptions/${s3.json?.id}`);
  check('fixed-term subscription offers renew', s3d.json?.allowed_actions?.includes('renew'), short(s3d.json?.allowed_actions));
  const rn = await staff.post(`/subscriptions/${s3.json?.id}/renew`, {});
  check('renew', ok2(rn), `${rn.status} ${short(rn.json?.error ?? rn.json?.number ?? rn.json?.status)}`);
  // Blank subscription for pause / resume / close
  const s2 = await staff.post('/subscriptions', { customer_id: custId, plan_id: planId, start_date: today, payment_term_id: termId, notes: 'e2e blank', lines: [{ product_id: prodId, variant_id: null, quantity: 2 }] });
  check('blank subscription with lines', ok2(s2), `${s2.status} ${short(s2.json?.error ?? s2.json?.id)}`);
  const sub2 = s2.json?.id;
  for (const to of ['quotation', 'confirmed', 'active']) await staff.post(`/subscriptions/${sub2}/transition`, { to });
  const pz = await staff.post(`/subscriptions/${sub2}/pause`, { note: 'e2e pause' });
  check('pause (plan allows)', ok2(pz), `${pz.status} ${short(pz.json?.error)}`);
  const pausedList = await staff.get(`/subscriptions?flag=paused&customer_id=${custId}`);
  check('list filter paused', ok2(pausedList) && pausedList.json?.data?.some((r) => r.id === sub2), `${pausedList.status} ${short(pausedList.json?.error)}`);
  const rz = await staff.post(`/subscriptions/${sub2}/resume`, {});
  check('resume', ok2(rz), `${rz.status} ${short(rz.json?.error)}`);
  const cz = await staff.post(`/subscriptions/${sub2}/close`, { reason: 'e2e close' });
  check('close early (plan allows)', ok2(cz), `${cz.status} ${short(cz.json?.error)}`);
  const sl = await staff.get(`/subscriptions?status=active&q=${encodeURIComponent(sd.json?.subscription?.number ?? '')}`);
  check('subscription list search by number', ok2(sl) && sl.json?.data?.some((r) => r.id === subId), `${sl.status} ${sl.json?.total} ${short(sl.json?.error)} ${sl.ms}ms`);
  const slAll = await staff.get('/subscriptions?page=1&page_size=20&sort=-created_at');
  check('subscription list under 2s', ok2(slAll) && slAll.ms < 2000, `${slAll.ms} ms, ${slAll.json?.total}`);

  // ---------- S3 billing ----------
  console.log('\n== S3 Billing ==');
  const prev = await staff.get('/billing/preview');
  check('billing preview', ok2(prev), `${prev.status} ${short(prev.json)}`);
  check('customer cannot run billing', (await cust.post('/billing/run', {})).status === 403);
  const run1 = await staff.post('/billing/run', {});
  check('billing run: 0 failed', ok2(run1) && run1.json?.failed_count === 0, `${run1.status} created ${run1.json?.created_count} failed ${run1.json?.failed_count} ${run1.ms} ms ${short(run1.json?.error)}`);
  const run2 = await staff.post('/billing/run', {});
  check('second run creates 0', ok2(run2) && run2.json?.created_count === 0, `${run2.status} created ${run2.json?.created_count}`);
  const runs = await staff.get('/billing/runs?page=1&page_size=5');
  check('billing run history', ok2(runs) && runs.json?.data?.[0]?.id === run2.json?.id, `${runs.status} ${short(runs.json?.error)}`);
  const il = await staff.get(`/invoices?subscription_id=${subId}`);
  check('exactly one invoice for the subscription', ok2(il) && il.json?.total === 1, `${il.status} ${il.json?.total} ${short(il.json?.error)}`);
  const invId = il.json?.data?.[0]?.id;
  let inv = await staff.get(`/invoices/${invId}`);
  // 12 × (1000 + 560) = 18,720 − 10% = 16,848 + 18% tax = 19,880.64
  check('invoice totals (12 × 1,560, −10%, +18% GST)', Number(inv.json?.total) === 19880.64,
    `subtotal ${inv.json?.subtotal} discount ${inv.json?.discount_amount} ${inv.json?.discount_name} tax ${inv.json?.tax_amount} total ${inv.json?.total}`);
  check('invoice has lines and customer', (inv.json?.lines?.length ?? 0) >= 1 && !!inv.json?.customer_id, `${inv.json?.lines?.length} lines, status ${inv.json?.status}`);
  const pay0 = await staff.post(`/invoices/${invId}/payments`, { amount: 100, method: 'cash' });
  check('payment on Draft refused', pay0.status === 409, `${pay0.status} ${pay0.json?.error?.code}`);
  const conf = await staff.post(`/invoices/${invId}/confirm`, {});
  check('confirm invoice', ok2(conf), `${conf.status} ${short(conf.json?.error ?? conf.json?.status)}`);
  const send = await staff.post(`/invoices/${invId}/send`, {});
  check('send invoice email', ok2(send), `${send.status} ${short(send.json)}`);
  const prt = await staff.page(`/print/invoices/${invId}`);
  check('print page renders for staff (cookie session)', prt.status === 200 && prt.html.includes(inv.json?.number ?? '§'), `${prt.status} ${prt.location ?? ''}`);
  const ovl = await staff.get('/invoices?overdue=true&page=1&page_size=20&sort=due_date');
  check('overdue invoice list', ok2(ovl) && ovl.json?.total > 0, `${ovl.status} ${ovl.json?.total} ${ovl.ms} ms`);
  const isearch = await staff.get(`/invoices?q=${encodeURIComponent(inv.json?.number ?? '')}`);
  check('invoice search by number', ok2(isearch) && isearch.json?.total >= 1, `${isearch.status} ${isearch.json?.total} ${short(isearch.json?.error)}`);
  // Cancel + bulk confirm on drafts from this run
  const drafts = await staff.get(`/invoices?status=draft&page=1&page_size=3&sort=-invoice_date`);
  const dIds = (drafts.json?.data ?? []).map((r) => r.id).filter((x) => x !== invId);
  if (dIds.length >= 3) {
    const cn = await staff.post(`/invoices/${dIds[0]}/cancel`, { reason: 'e2e cancel test' });
    check('cancel a draft invoice', ok2(cn), `${cn.status} ${short(cn.json?.error ?? cn.json?.status)}`);
    const bulk = await staff.post('/invoices', { ids: dIds.slice(1, 3) });
    check('bulk confirm drafts', ok2(bulk), `${bulk.status} ${short(bulk.json)}`);
  } else check('drafts available for cancel / bulk confirm', false, String(dIds.length));

  // ---------- S4 payments & reports ----------
  console.log('\n== S4 Payments & reports ==');
  const p1 = await staff.post(`/invoices/${invId}/payments`, { amount: 5000, method: 'upi', paid_on: today, note: 'e2e part 1' });
  check('first payment', ok2(p1), `${p1.status} due ${p1.json?.amount_due} ${short(p1.json?.error)}`);
  const over = await staff.post(`/invoices/${invId}/payments`, { amount: 999999, method: 'cash' });
  check('overpayment refused', over.status === 409, `${over.status} ${over.json?.error?.code}`);
  inv = await staff.get(`/invoices/${invId}`);
  const p2 = await staff.post(`/invoices/${invId}/payments`, { amount: Number(inv.json?.amount_due), method: 'bank_transfer', note: 'e2e rest' });
  check('second payment → Paid', ok2(p2) && p2.json?.status === 'paid', `${p2.status} ${p2.json?.status} ${short(p2.json?.error)}`);
  const ip = await staff.get(`/invoices/${invId}/payments`);
  check('invoice payment history', ok2(ip) && ip.json?.data?.length === 2, `${ip.status} ${short(ip.json?.error ?? ip.json?.data?.length)}`);
  check('customer cannot record payment', (await cust.post(`/invoices/${invId}/payments`, { amount: 1, method: 'cash' })).status === 403);
  const pays = await staff.get('/payments?page=1&page_size=20');
  check('payments list', ok2(pays) && pays.json?.total > 0, `${pays.status} ${pays.json?.total} ${pays.ms} ms ${short(pays.json?.error)}`);
  const paysQ = await staff.get(`/payments?q=${encodeURIComponent(inv.json?.number ?? '')}`);
  check('payments search', ok2(paysQ), `${paysQ.status} ${paysQ.json?.total} ${short(paysQ.json?.error)}`);
  const paysM = await staff.get(`/payments?method=upi&from=${today}&to=${today}`);
  check('payments filter by method + date', ok2(paysM) && paysM.json?.data?.some((r) => r.invoice_id === invId), `${paysM.status} ${paysM.json?.total}`);
  const yearAgo = new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10);
  for (const [name, path] of [
    ['summary', `/reports/summary?from=${yearAgo}&to=${today}`],
    ['summary by plan', `/reports/summary?from=${yearAgo}&to=${today}&plan_id=${planId}`],
    ['revenue', `/reports/revenue?from=${yearAgo}&to=${today}&bucket=month`],
    ['overdue buckets', '/reports/overdue'],
    ['overdue list', '/reports/overdue-list'],
    ['renewals', '/reports/renewals?days=30'],
  ]) {
    const r = await staff.get(path);
    check(`report ${name} < 2 s`, ok2(r) && r.ms < 2000, `${r.status} ${r.ms} ms ${short(r.json?.error ?? r.json)?.slice(0, 160)}`);
  }
  check('customer cannot read reports', (await cust.get(`/reports/summary?from=${yearAgo}&to=${today}`)).status === 403);

  // ---------- Admin users ----------
  console.log('\n== Users ==');
  check('staff cannot list users', (await staff.get('/admin/users')).status === 403);
  const ul = await admin.get('/admin/users');
  check('admin lists users', ok2(ul), `${ul.status} ${short(ul.json?.error)}`);
  const nu = await admin.post('/admin/users', { full_name: `E2E Staff ${TS}`, email: `e2e.staff${TS}@example.test`, role: 'staff' });
  check('admin adds staff', ok2(nu), `${nu.status} ${short(nu.json?.error ?? nu.json)}`);
  const nuId = nu.json?.id ?? nu.json?.user?.id ?? nu.json?.profile?.id;
  if (nuId) {
    const de = await admin.patch(`/admin/users/${nuId}`, { is_active: false });
    check('admin deactivates staff', ok2(de), `${de.status} ${short(de.json?.error)}`);
  }

  // ---------- Portal (customer) ----------
  console.log('\n== Portal ==');
  const ps = await cust.get('/subscriptions?page=1&page_size=20');
  check('customer sees own subscriptions, no Draft', ok2(ps) && ps.json?.data?.every((r) => r.customer_id === me.json?.customer_id && r.status !== 'draft'), `${ps.status} ${ps.json?.total}`);
  check("customer cannot see another customer's subscription", (await cust.get(`/subscriptions/${subId}`)).status === 404, String((await cust.get(`/subscriptions/${subId}`)).status));
  check("customer cannot see another customer's invoice", (await cust.get(`/invoices/${invId}`)).status === 404);
  const own = ps.json?.data?.[0];
  if (own) {
    const od = await cust.get(`/subscriptions/${own.id}`);
    check('customer subscription detail with actions', ok2(od), `${od.status} actions=${short(od.json?.allowed_actions)}`);
  }
  let pausable = null;
  for (const r of ps.json?.data ?? []) { const d = await cust.get(`/subscriptions/${r.id}`); if (d.json?.allowed_actions?.includes('pause')) { pausable = r; break; } }
  check('customer has a pausable subscription (plan allows)', !!pausable);
  if (pausable) {
    const cpz = await cust.post(`/subscriptions/${pausable.id}/pause`, { note: 'e2e portal pause' });
    check('customer pauses own subscription', ok2(cpz), `${cpz.status} ${short(cpz.json?.error)}`);
    const crz = await cust.post(`/subscriptions/${pausable.id}/resume`, {});
    check('customer resumes own subscription', ok2(crz), `${crz.status} ${short(crz.json?.error)}`);
  }
  const pi = await cust.get('/invoices?page=1&page_size=20');
  check('customer sees own invoices, no Draft', ok2(pi) && pi.json?.data?.every((r) => r.customer_id === me.json?.customer_id && r.status !== 'draft'), `${pi.status} ${pi.json?.total}`);
  const oinv = pi.json?.data?.[0];
  if (oinv) {
    const oi = await cust.get(`/invoices/${oinv.id}`);
    check('customer invoice detail', ok2(oi), String(oi.status));
    const oip = await cust.get(`/invoices/${oinv.id}/payments`);
    check('customer invoice payments', ok2(oip), String(oip.status));
    const pp = await cust.page(`/print/invoices/${oinv.id}`);
    check('customer print page', pp.status === 200, `${pp.status} ${pp.location ?? ''}`);
  }
  const cpay = await cust.get('/payments');
  check('customer payments list (own)', ok2(cpay) && cpay.json?.data?.every((r) => r.customer_id === me.json?.customer_id), `${cpay.status} ${cpay.json?.total} ${short(cpay.json?.error)}`);
  const prof = await cust.get(`/customers/${me.json?.customer_id}`);
  check('customer reads own profile', ok2(prof), String(prof.status));
  const pr = await cust.patch(`/customers/${me.json?.customer_id}`, { phone: prof.json?.phone ?? '9000000000' });
  check('customer updates own profile', ok2(pr), `${pr.status} ${short(pr.json?.error)}`);
  check('customer cannot open another customer', [403, 404].includes((await cust.get(`/customers/${custId}`)).status));
  const cc = await cust.get('/customers');
  check('customer /customers returns only own record', cc.json?.total === 1 && cc.json?.data?.[0]?.id === me.json?.customer_id, `${cc.status} ${cc.json?.total}`);

  // ---------- Pages (server render + guards) ----------
  console.log('\n== Pages ==');
  const appPages = ['/app', '/app/subscriptions', '/app/subscriptions/new', `/app/subscriptions/${subId}`, '/app/customers', `/app/customers/${custId}`,
    '/app/invoices', `/app/invoices/${invId}`, '/app/billing', '/app/payments', '/app/products', '/app/products/new', `/app/products/${prodId}`,
    '/app/plans', '/app/plans/new', `/app/plans/${planId}`, '/app/templates', '/app/templates/new', `/app/templates/${tplId}`,
    '/app/discounts', '/app/discounts/new', `/app/discounts/${discId}`, '/app/settings', '/app/users'];
  for (const p of appPages) {
    const r = await admin.page(p);
    check(`admin page ${p}`, r.status === 200 && !/Application error|Internal Server Error/.test(r.html), `${r.status} ${r.location ?? ''}`);
  }

  const portalPages = ['/portal', '/portal/invoices', '/portal/profile', ...(own ? [`/portal/subscriptions/${own.id}`] : []), ...(oinv ? [`/portal/invoices/${oinv.id}`] : [])];
  for (const p of portalPages) {
    const r = await cust.page(p);
    check(`customer page ${p}`, r.status === 200, `${r.status} ${r.location ?? ''}`);
  }
  const ca = await cust.page('/app');
  check('customer is redirected away from /app', ca.status !== 200, `${ca.status} → ${ca.location}`);
  const aa = await anon.page('/app/invoices');
  check('anonymous is redirected to login', [302, 303, 307, 308].includes(aa.status) && (aa.location ?? '').includes('/login'), `${aa.status} → ${aa.location}`);

  console.log(`\nIDs: ${JSON.stringify({ taxId, termId, prodId, planId, tplId, discId, custId, subId, sub2, invId })}`);
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll e2e checks passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
