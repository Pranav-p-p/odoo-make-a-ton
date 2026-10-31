'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import { useApi } from '@/lib/client/hooks';
import { money, moneyShort, date, today } from '@/lib/format';
import type { ReportSummary, RevenuePoint, OverdueBucket, InvoiceListRow } from '@/lib/types';
import {
  PageHeader, Stat, Card, CardHeader, CardBody,
  DataTable, Badge, Input, Select, Field,
  type Column,
} from '@/components/ui';

// ── Default date range: 1 year back from today ──
function defaultRange(): { from: string; to: string } {
  const t = today();
  const y = parseInt(t.slice(0, 4), 10);
  return { from: `${y - 1}${t.slice(4)}`, to: t };
}

// ── Chart tooltip ──
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {money(p.value)}</p>
      ))}
    </div>
  );
}

// ── Overdue table columns ──
const overdueColumns: Column<InvoiceListRow>[] = [
  { key: 'number', header: 'Invoice', cell: (r) => (
    <Link href={`/app/invoices/${r.id}`} className="font-medium text-brand-600 hover:underline">{r.number}</Link>
  )},
  { key: 'customer', header: 'Customer', cell: (r) => r.customer_name },
  { key: 'due_date', header: 'Due date', cell: (r) => date(r.due_date) },
  { key: 'days_overdue', header: 'Days overdue', align: 'right', cell: (r) => (
    <Badge tone={r.days_overdue > 60 ? 'red' : r.days_overdue > 30 ? 'amber' : 'gray'}>{r.days_overdue}d</Badge>
  )},
  { key: 'amount_due', header: 'Amount due', align: 'right', cell: (r) => (
    <span className="font-medium tabular-nums text-red-600">{money(r.amount_due)}</span>
  )},
];

// ── Chart month formatter ──
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatPeriod(d: string) {
  const [, m] = d.split('-');
  return MONTHS[parseInt(m, 10) - 1] ?? d;
}

// ── Plan search dropdown (lightweight: fetches all active plans) ──
function PlanFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data } = useApi<{ data: { id: string; name: string }[]; total: number }>('/plans', { page_size: 100, sort: 'name' });
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All plans</option>
      {data?.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </Select>
  );
}

// ── Customer search dropdown ──
function CustomerFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState('');
  const { data } = useApi<{ data: { id: string; name: string; company_name: string | null }[]; total: number }>(
    '/customers', { page_size: 20, sort: 'name', q: q || undefined },
  );
  return (
    <div className="space-y-1">
      <input
        type="text"
        placeholder="Search customer…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 h-10 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {data?.data && data.data.length > 0 && (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">All customers</option>
          {data.data.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` (${c.company_name})` : ''}</option>
          ))}
        </Select>
      )}
    </div>
  );
}

// ── Renewals widget data shape ──
interface RenewalsData {
  expiring_count: number;
  out_of_term_count: number;
  expiring: { id: string; number: string; customer_name: string; plan_name: string; expiry_date: string }[];
  out_of_term: { id: string; number: string; customer_name: string; plan_name: string; expiry_date: string }[];
}

// ── Main Dashboard ──
export default function DashboardPage() {
  const defaults = useMemo(defaultRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [planId, setPlanId] = useState('');
  const [customerId, setCustomerId] = useState('');

  // ── Data fetching ──
  const summary = useApi<ReportSummary>('/reports/summary', {
    from, to,
    plan_id: planId || undefined,
    customer_id: customerId || undefined,
  });

  const revenue = useApi<RevenuePoint[]>('/reports/revenue', { from, to, bucket: 'month' });
  const overdue = useApi<OverdueBucket[]>('/reports/overdue');

  // Overdue invoice list: query the invoice_list view directly via a
  // lightweight API call. This avoids depending on S3's /invoices route.
  const overdueInvoices = useApi<InvoiceListRow[]>('/reports/overdue-list');

  const renewals = useApi<RenewalsData>('/reports/renewals', { days: 30 });

  const s = summary.data;
  const loading = summary.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Company position at a glance" />

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          {(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} className="w-40" />}
        </Field>
        <Field label="To">
          {(id) => <Input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={today()} className="w-40" />}
        </Field>
        <Field label="Plan">
          {() => <PlanFilter value={planId} onChange={setPlanId} />}
        </Field>
        <Field label="Customer">
          {() => <CustomerFilter value={customerId} onChange={setCustomerId} />}
        </Field>
      </div>

      {/* ── KPI Cards: row 1 ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Active subscriptions" value={loading ? '…' : s?.active_subscriptions?.toLocaleString('en-IN') ?? '0'} tone="good" />
        <Stat
          label="Paused / Out of term"
          value={loading ? '…' : `${s?.paused_subscriptions ?? 0} / ${s?.out_of_term_subscriptions ?? 0}`}
          tone={(s?.out_of_term_subscriptions ?? 0) > 0 ? 'bad' : 'default'}
        />
        <Stat label="Revenue received" value={loading ? '…' : moneyShort(s?.revenue_received)} tone="good" hint={s ? `${s.payments_count} payments` : undefined} />
        <Stat label="Invoiced" value={loading ? '…' : moneyShort(s?.invoiced)} />
        <Stat label="Outstanding" value={loading ? '…' : moneyShort(s?.outstanding)} tone={(s?.outstanding ?? 0) > 0 ? 'bad' : 'default'} />
        <Stat
          label="Overdue"
          value={loading ? '…' : moneyShort(s?.overdue_amount)}
          tone={(s?.overdue_count ?? 0) > 0 ? 'bad' : 'default'}
          hint={s ? `${s.overdue_count} invoices` : undefined}
        />
      </div>

      {/* ── KPI Cards: row 2 (MRR / ARR) ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="MRR" value={loading ? '…' : moneyShort(s?.mrr)} tone="good" hint="Monthly recurring revenue" />
        <Stat label="ARR" value={loading ? '…' : moneyShort(s?.arr)} tone="good" hint="Annual recurring revenue" />
      </div>

      {/* ── Revenue Chart ── */}
      <Card>
        <CardHeader title="Revenue: received vs invoiced" description="Per month in the selected period" />
        <CardBody className="h-80">
          {revenue.isLoading ? (
            <div className="flex h-full items-center justify-center text-slate-400">Loading chart…</div>
          ) : revenue.data && revenue.data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue.data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tickFormatter={formatPeriod} fontSize={12} />
                <YAxis tickFormatter={(v) => moneyShort(v)} fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="received" name="Received" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="invoiced" name="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">No revenue data for this period.</div>
          )}
        </CardBody>
      </Card>

      {/* ── Overdue Buckets + List ── */}
      <Card>
        <CardHeader
          title="Overdue invoices"
          description="Unpaid invoices past their due date"
          actions={
            <Link href="/app/invoices?status=confirmed&overdue=true" className="text-sm text-brand-600 hover:underline">
              View all →
            </Link>
          }
        />
        {/* Age buckets summary */}
        {overdue.data && (
          <div className="grid grid-cols-4 gap-px border-b border-slate-200 bg-slate-100">
            {overdue.data.map((b) => (
              <div key={b.bucket} className="bg-white px-4 py-3 text-center">
                <p className="text-xs text-slate-500">{b.bucket} days</p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">{b.invoices}</p>
                <p className="text-xs tabular-nums text-red-600">{money(b.amount)}</p>
              </div>
            ))}
          </div>
        )}
        <CardBody className="p-0">
          <DataTable
            rows={overdueInvoices.data}
            columns={overdueColumns}
            loading={overdueInvoices.isLoading}
            empty="No overdue invoices — great!"
            rowHref={(r) => `/app/invoices/${r.id}`}
          />
        </CardBody>
      </Card>

      {/* ── Renewals Widget (Should) ── */}
      {renewals.data && (renewals.data.expiring_count > 0 || renewals.data.out_of_term_count > 0) && (
        <Card>
          <CardHeader
            title="Upcoming renewals"
            description="Subscriptions expiring in 30 days and out-of-term"
          />
          <CardBody>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Expiring soon */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  Expiring soon
                  <Badge tone="amber">{renewals.data.expiring_count}</Badge>
                </h3>
                {renewals.data.expiring.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {renewals.data.expiring.map((sub) => (
                      <li key={sub.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                        <Link href={`/app/subscriptions/${sub.id}`} className="font-medium text-brand-600 hover:underline">
                          {sub.number}
                        </Link>
                        <span className="text-slate-500">{sub.customer_name} · {sub.plan_name}</span>
                        <span className="tabular-nums text-amber-700">{date(sub.expiry_date)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">None in the next 30 days.</p>
                )}
              </div>

              {/* Out of term */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  Out of term
                  <Badge tone="red">{renewals.data.out_of_term_count}</Badge>
                </h3>
                {renewals.data.out_of_term.length > 0 ? (
                  <ul className="space-y-1.5 text-sm">
                    {renewals.data.out_of_term.map((sub) => (
                      <li key={sub.id} className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2">
                        <Link href={`/app/subscriptions/${sub.id}`} className="font-medium text-brand-600 hover:underline">
                          {sub.number}
                        </Link>
                        <span className="text-slate-500">{sub.customer_name} · {sub.plan_name}</span>
                        <Badge tone="red">Expired {date(sub.expiry_date)}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">No out-of-term subscriptions.</p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
