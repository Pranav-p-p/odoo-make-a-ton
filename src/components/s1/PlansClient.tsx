'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApiList } from '@/lib/client/hooks';
import { api, type ApiClientError } from '@/lib/client/api';
import {
  PageHeader, SearchInput, Badge, DataTable, type Column,
  Button, ButtonLink, Pagination, EmptyState, Field, Input, Select, Switch,
} from '@/components/ui';
import { money, today } from '@/lib/format';
import type { Plan, BillingPeriod, Tax } from '@/lib/types';

const PERIOD_LABEL: Record<BillingPeriod, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
};

function availabilityStatus(plan: Plan): { label: string; tone: 'green' | 'amber' | 'red' } {
  const t = today();
  if (t < plan.available_from) return { label: 'Not yet available', tone: 'amber' };
  if (plan.available_to && t > plan.available_to) return { label: 'No longer available', tone: 'red' };
  return { label: 'Available now', tone: 'green' };
}

// ── Plans list ────────────────────────────────────────────────────────────────

export function PlansClient({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const handleSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const { data, isLoading } = useApiList<Plan>('/plans', {
    page,
    page_size: 20,
    q: q || undefined,
    active: showArchived ? 'all' : 'true',
  });

  const columns: Column<Plan>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'period', header: 'Period', cell: (r) => <Badge tone="blue">{PERIOD_LABEL[r.billing_period]}</Badge> },
    { key: 'price', header: 'Price', align: 'right', cell: (r) => money(r.price) },
    { key: 'min_qty', header: 'Min qty', align: 'center', cell: (r) => <span>{r.min_quantity}</span> },
    {
      key: 'availability', header: 'Availability',
      cell: (r) => {
        const s = availabilityStatus(r);
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    {
      key: 'switches', header: 'Features',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.allow_pause && <Badge tone="purple">Pause</Badge>}
          {r.allow_renew && <Badge tone="indigo">Renew</Badge>}
          {r.allow_early_close && <Badge tone="gray">Early close</Badge>}
          {r.auto_close && <Badge tone="amber">Auto-close</Badge>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      cell: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Archived'}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Plans"
        description="Subscription plans with pricing and lifecycle settings."
        actions={isAdmin ? <ButtonLink href="/app/plans/new" variant="primary">+ New plan</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput onSearch={handleSearch} placeholder="Search plans…" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {data?.data?.length === 0 && !isLoading ? (
          <EmptyState title="No plans found" action={isAdmin ? <ButtonLink href="/app/plans/new" variant="secondary">New plan</ButtonLink> : undefined} />
        ) : (
          <DataTable rows={data?.data} columns={columns} loading={isLoading} rowHref={(r) => `/app/plans/${r.id}`} />
        )}
      </div>
      {data && data.total > data.page_size && (
        <div className="mt-4">
          <Pagination page={page} pageSize={data.page_size} total={data.total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

// ── Plan form ────────────────────────────────────────────────────────────────

export function PlanForm({ initial, isAdmin }: { initial?: Plan; isAdmin: boolean }) {
  const router = useRouter();
  const isEdit = !!initial;
  const t = today();

  const [name, setName] = useState(initial?.name ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [period, setPeriod] = useState<BillingPeriod>(initial?.billing_period ?? 'monthly');
  const [minQty, setMinQty] = useState(initial ? String(initial.min_quantity) : '1');
  const [availFrom, setAvailFrom] = useState(initial?.available_from ?? t);
  const [availTo, setAvailTo] = useState(initial?.available_to ?? '');
  const [autoClose, setAutoClose] = useState(initial?.auto_close ?? false);
  const [earlyClose, setEarlyClose] = useState(initial?.allow_early_close ?? true);
  const [pause, setPause] = useState(initial?.allow_pause ?? false);
  const [renew, setRenew] = useState(initial?.allow_renew ?? true);
  const [taxId, setTaxId] = useState(initial?.tax_id ?? '');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const { data: taxData } = useApiList<Tax>('/taxes', { page_size: 100 });
  const taxes = taxData?.data ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrors({});
    const body = {
      name: name.trim(), price: Number(price), billing_period: period,
      min_quantity: Number(minQty), available_from: availFrom,
      available_to: availTo || null, auto_close: autoClose,
      allow_early_close: earlyClose, allow_pause: pause, allow_renew: renew,
      tax_id: taxId || null,
    };
    try {
      if (isEdit) {
        await api.patch(`/plans/${initial!.id}`, body);
        router.refresh();
      } else {
        const res = await api.post<Plan>('/plans', body);
        router.push(`/app/plans/${res.id}`);
      }
    } catch (e) {
      const err = e as ApiClientError;
      setErrors(err.fieldErrors ?? { _: [err.message] });
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm(`Archive "${name}"?`)) return;
    setArchiving(true);
    try { await api.patch(`/plans/${initial!.id}`, { is_active: false }); router.push('/app/plans'); }
    catch (e) { alert((e as ApiClientError).message); }
    finally { setArchiving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {errors._ && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errors._[0]}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Plan name" required error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Monthly" aria-invalid={!!errors.name} />}
        </Field>
        <Field label="Price (₹ per period)" required error={errors.price}>
          {(id) => <Input id={id} type="number" min={0} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" aria-invalid={!!errors.price} />}
        </Field>
        <Field label="Billing period" required error={errors.billing_period}>
          {(id) => (
            <Select id={id} value={period} onChange={(e) => setPeriod(e.target.value as BillingPeriod)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </Select>
          )}
        </Field>
        <Field label="Minimum quantity" required error={errors.min_quantity} hint="Minimum seats / units per subscription">
          {(id) => <Input id={id} type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} aria-invalid={!!errors.min_quantity} />}
        </Field>
        <Field label="Tax" error={errors.tax_id}>
          {(id) => (
            <Select id={id} value={taxId} onChange={(e) => setTaxId(e.target.value)}>
              <option value="">— None —</option>
              {taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.rate_percent}%)</option>)}
            </Select>
          )}
        </Field>
        <Field label="Available from" required error={errors.available_from}>
          {(id) => <Input id={id} type="date" value={availFrom} onChange={(e) => setAvailFrom(e.target.value)} aria-invalid={!!errors.available_from} />}
        </Field>
        <Field label="Available to" error={errors.available_to} hint="Leave blank for no end date">
          {(id) => <Input id={id} type="date" value={availTo} onChange={(e) => setAvailTo(e.target.value)} aria-invalid={!!errors.available_to} />}
        </Field>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Lifecycle settings</p>
        <Switch checked={autoClose} onChange={setAutoClose} label="Auto-close" description="Closes by itself on the expiry date." disabled={!isAdmin} />
        <Switch checked={earlyClose} onChange={setEarlyClose} label="Early close" description="Can be closed before the expiry date." disabled={!isAdmin} />
        <Switch checked={pause} onChange={setPause} label="Pause" description="Can be paused and resumed." disabled={!isAdmin} />
        <Switch checked={renew} onChange={setRenew} label="Renew" description="Can be extended by one more period." disabled={!isAdmin} />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {isAdmin && <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create plan'}</Button>}
          <ButtonLink href="/app/plans" variant="ghost">Cancel</ButtonLink>
        </div>
        {isEdit && isAdmin && initial?.is_active && (
          <Button type="button" variant="ghost" loading={archiving} onClick={archive} className="text-red-600 hover:text-red-700">Archive</Button>
        )}
      </div>
    </form>
  );
}
