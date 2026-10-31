// S4 · Speed proof (NFR-1): measures API response times at seed volume.
// Run: npm run speed-proof  (needs the dev server at localhost:3000)
//
// Uses fetch() against the local API with an admin session cookie.
// Outputs a markdown table suitable for the README.

const BASE = process.env.APP_URL || 'http://localhost:3000';

interface Endpoint {
  label: string;
  path: string;
}

const ENDPOINTS: Endpoint[] = [
  { label: 'Dashboard summary', path: '/api/v1/reports/summary?from=2025-01-01&to=2026-10-31' },
  { label: 'Revenue chart', path: '/api/v1/reports/revenue?from=2025-01-01&to=2026-10-31&bucket=month' },
  { label: 'Overdue buckets', path: '/api/v1/reports/overdue' },
  { label: 'Overdue list', path: '/api/v1/reports/overdue-list' },
  { label: 'Renewals', path: '/api/v1/reports/renewals?days=30' },
  { label: 'Payments list', path: '/api/v1/payments?page=1&page_size=20' },
  { label: 'Invoices list', path: '/api/v1/invoices?page=1&page_size=20' },
  { label: 'Subscriptions list', path: '/api/v1/subscriptions?page=1&page_size=20' },
  { label: 'Customers list', path: '/api/v1/customers?page=1&page_size=20' },
];

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@brightloop.test', password: 'Admin@12345' }),
    redirect: 'manual',
  });
  // Collect all set-cookie headers
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.join('; ');
}

async function measure(path: string, cookie: string): Promise<{ ms: number; status: number }> {
  const start = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie },
  });
  const ms = Math.round(performance.now() - start);
  // consume the body
  await res.text();
  return { ms, status: res.status };
}

async function main() {
  console.log('Logging in as admin…');
  const cookie = await login();
  if (!cookie) {
    console.error('Login failed — no cookies received. Is the dev server running?');
    process.exit(1);
  }
  console.log('Warming up…');
  // Warm-up: hit each endpoint once
  for (const ep of ENDPOINTS) {
    await measure(ep.path, cookie).catch(() => {});
  }

  console.log('\nMeasuring (3 runs each)…\n');

  const results: { label: string; avg: number; status: number; pass: boolean }[] = [];

  for (const ep of ENDPOINTS) {
    const times: number[] = [];
    let lastStatus = 0;
    for (let i = 0; i < 3; i++) {
      const { ms, status } = await measure(ep.path, cookie);
      times.push(ms);
      lastStatus = status;
    }
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    results.push({ label: ep.label, avg, status: lastStatus, pass: avg < 2000 });
  }

  // Output markdown table
  console.log('## Speed proof (NFR-1)\n');
  console.log('Measured against the seeded database (~5,000 subscriptions, ~22,000 invoices).');
  console.log('Each value is the average of 3 runs after a warm-up.\n');
  console.log('| Endpoint | Avg (ms) | Status | Pass (< 2 s) |');
  console.log('|---|---|---|---|');
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    const statusLabel = r.status === 200 ? '200' : r.status === 404 ? '404 (not built yet)' : String(r.status);
    console.log(`| ${r.label} | ${r.avg} ms | ${statusLabel} | ${icon} |`);
  }

  const allPass = results.every((r) => r.pass);
  console.log(`\n${allPass ? '✅ All endpoints under 2 s.' : '❌ Some endpoints exceeded 2 s — see above.'}`);

  if (!allPass) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

