'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApiList } from '@/lib/client/hooks';
import { api, type ApiClientError } from '@/lib/client/api';
import {
  PageHeader, SearchInput, Badge, DataTable, type Column,
  Button, ButtonLink, Pagination, EmptyState, Field, Input,
  Select, Card, CardHeader, CardBody,
} from '@/components/ui';
import { money, today } from '@/lib/format';
import type { DiscountRule, DiscountKind, DiscountScope, DiscountCondition, Product } from '@/lib/types';

// ── Badge logic ──────────────────────────────────────────────────────────────

function DiscountStatusBadge({ rule }: { rule: DiscountRule }) {
  if (!rule.is_active) return <Badge tone="gray">Archived</Badge>;
  if (rule.usage_limit !== null && rule.used_count >= rule.usage_limit) return <Badge tone="red">Used up</Badge>;
  const t = today();
  if (rule.ends_on && t > rule.ends_on) return <Badge tone="red">Expired</Badge>;
  if (t < rule.starts_on) return <Badge tone="blue">Scheduled</Badge>;
  return <Badge tone="green">Active</Badge>;
}

// ── Discounts list ────────────────────────────────────────────────────────────

export function DiscountsClient({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const handleSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const { data, isLoading } = useApiList<DiscountRule>('/discount-rules', {
    page,
    page_size: 20,
    q: q || undefined,
    active: showArchived ? 'all' : 'true',
  });

  const columns: Column<DiscountRule>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    {
      key: 'value', header: 'Discount',
      cell: (r) => r.kind === 'percent'
        ? <span>{r.value}%</span>
        : <span>{money(r.value)} off</span>,
    },
    {
      key: 'scope', header: 'Scope',
      cell: (r) => <Badge tone={r.scope === 'products' ? 'indigo' : 'blue'}>{r.scope === 'products' ? 'Products' : 'Whole subscription'}</Badge>,
    },
    {
      key: 'condition', header: 'Condition',
      cell: (r) => r.condition === 'none'
        ? <span className="text-slate-400">None</span>
        : <span className="text-sm text-slate-700">{r.condition === 'min_purchase' ? `Min ₹${r.condition_value}` : `Min ${r.condition_value} units`}</span>,
    },
    {
      key: 'usage', header: 'Used / Limit', align: 'center',
      cell: (r) => r.usage_limit !== null
        ? <span className={r.used_count >= r.usage_limit ? 'font-medium text-red-600' : ''}>{r.used_count} / {r.usage_limit}</span>
        : <span className="text-slate-400">Unlimited</span>,
    },
    { key: 'status', header: 'Status', cell: (r) => <DiscountStatusBadge rule={r} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Discount rules"
        description="Automatic discounts applied during invoice generation."
        actions={isAdmin ? <ButtonLink href="/app/discounts/new" variant="primary">+ New rule</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput onSearch={handleSearch} placeholder="Search rules…" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {data?.data?.length === 0 && !isLoading ? (
          <EmptyState title="No discount rules found" action={isAdmin ? <ButtonLink href="/app/discounts/new" variant="secondary">New rule</ButtonLink> : undefined} />
        ) : (
          <DataTable rows={data?.data} columns={columns} loading={isLoading} rowHref={(r) => `/app/discounts/${r.id}`} />
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

// ── Product picker ───────────────────────────────────────────────────────────

function ProductPicker({ selected, onChange, products }: {
  selected: string[];
  onChange: (ids: string[]) => void;
  products: Product[];
}) {
  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="max-h-48 overflow-y-auto rounded-md border border-slate-300 bg-white p-2">
      {products.length === 0 && <p className="text-sm text-slate-400 p-1">No products available.</p>}
      {products.map((p) => (
        <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
          <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
          <span className="text-sm text-slate-800">{p.name}</span>
          <span className="ml-auto text-xs text-slate-400">{money(p.sales_price)}</span>
        </label>
      ))}
    </div>
  );
}

// ── Discount rule form ────────────────────────────────────────────────────────

export function DiscountRuleForm({ initial, isAdmin }: { initial?: DiscountRule; isAdmin: boolean }) {
  const router = useRouter();
  const isEdit = !!initial;
  const t = today();

  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<DiscountKind>(initial?.kind ?? 'percent');
  const [value, setValue] = useState(initial ? String(initial.value) : '');
  const [scope, setScope] = useState<DiscountScope>(initial?.scope ?? 'subscription');
  const [productIds, setProductIds] = useState<string[]>(initial?.product_ids ?? []);
  const [condition, setCondition] = useState<DiscountCondition>(initial?.condition ?? 'none');
  const [conditionValue, setConditionValue] = useState(initial?.condition_value ? String(initial.condition_value) : '');
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? t);
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? '');
  const [usageLimit, setUsageLimit] = useState(initial?.usage_limit ? String(initial.usage_limit) : '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const { data: productData } = useApiList<Product>('/products', { page_size: 100 });
  const products = productData?.data ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrors({});
    const body = {
      name: name.trim(),
      kind,
      value: Number(value),
      scope,
      product_ids: scope === 'products' ? productIds : [],
      condition,
      condition_value: condition !== 'none' ? Number(conditionValue) : null,
      starts_on: startsOn,
      ends_on: endsOn || null,
      usage_limit: usageLimit ? Number(usageLimit) : null,
    };
    try {
      if (isEdit) {
        await api.patch(`/discount-rules/${initial!.id}`, body);
        router.refresh();
      } else {
        const res = await api.post<DiscountRule>('/discount-rules', body);
        router.push(`/app/discounts/${res.id}`);
      }
    } catch (e) {
      const err = e as ApiClientError;
      setErrors(err.fieldErrors ?? { _: [err.message] });
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm(`Archive "${name}"?`)) return;
    try { await api.patch(`/discount-rules/${initial!.id}`, { is_active: false }); router.push('/app/discounts'); }
    catch (e) { alert((e as ApiClientError).message); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {errors._ && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errors._[0]}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Rule name" required error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10% from 10 seats" aria-invalid={!!errors.name} disabled={!isAdmin} />}
        </Field>

        <Field label="Kind" required error={errors.kind}>
          {(id) => (
            <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as DiscountKind)} disabled={!isAdmin}>
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed amount (₹)</option>
            </Select>
          )}
        </Field>

        <Field
          label={kind === 'percent' ? 'Discount (%)' : 'Discount (₹)'}
          required
          error={errors.value}
          hint={kind === 'percent' ? 'Max 100' : undefined}
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              min={0}
              max={kind === 'percent' ? 100 : undefined}
              step={kind === 'percent' ? 0.01 : 1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!!errors.value}
              disabled={!isAdmin}
            />
          )}
        </Field>

        <Field label="Scope" required error={errors.scope} className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={scope} onChange={(e) => { setScope(e.target.value as DiscountScope); if (e.target.value !== 'products') setProductIds([]); }} disabled={!isAdmin}>
              <option value="subscription">Whole subscription (all lines including plan fee)</option>
              <option value="products">Specific products only</option>
            </Select>
          )}
        </Field>

        {scope === 'products' && (
          <div className="sm:col-span-2">
            <p className="mb-1.5 block text-sm font-medium text-slate-700">Products <span className="text-red-600">*</span></p>
            {errors.product_ids && <p className="mb-1 text-xs text-red-600">{errors.product_ids[0]}</p>}
            <ProductPicker selected={productIds} onChange={setProductIds} products={products} />
            {productIds.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">{productIds.length} product{productIds.length > 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        <Field label="Condition" required error={errors.condition}>
          {(id) => (
            <Select id={id} value={condition} onChange={(e) => { setCondition(e.target.value as DiscountCondition); setConditionValue(''); }} disabled={!isAdmin}>
              <option value="none">No condition</option>
              <option value="min_purchase">Minimum purchase (₹)</option>
              <option value="min_quantity">Minimum quantity (units)</option>
            </Select>
          )}
        </Field>

        {condition !== 'none' && (
          <Field
            label={condition === 'min_purchase' ? 'Minimum purchase (₹)' : 'Minimum quantity'}
            required
            error={errors.condition_value}
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                step={condition === 'min_purchase' ? 0.01 : 1}
                value={conditionValue}
                onChange={(e) => setConditionValue(e.target.value)}
                aria-invalid={!!errors.condition_value}
                disabled={!isAdmin}
              />
            )}
          </Field>
        )}

        <Field label="Starts on" required error={errors.starts_on}>
          {(id) => <Input id={id} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} disabled={!isAdmin} />}
        </Field>

        <Field label="Ends on" error={errors.ends_on} hint="Leave blank for no expiry">
          {(id) => <Input id={id} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} disabled={!isAdmin} />}
        </Field>

        <Field label="Usage limit" error={errors.usage_limit} hint="Max number of invoices this can be applied to. Leave blank for unlimited.">
          {(id) => <Input id={id} type="number" min={1} value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} disabled={!isAdmin} placeholder="Unlimited" />}
        </Field>
      </div>

      {/* Usage counter (edit mode) */}
      {isEdit && (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-medium">Usage: </span>
          {initial!.used_count} / {initial!.usage_limit ?? '∞'}
          {' · '}
          <DiscountStatusBadge rule={initial!} />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {isAdmin && <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create rule'}</Button>}
          <ButtonLink href="/app/discounts" variant="ghost">Cancel</ButtonLink>
        </div>
        {isEdit && isAdmin && initial?.is_active && (
          <Button type="button" variant="ghost" onClick={archive} className="text-red-600 hover:text-red-700">Archive</Button>
        )}
      </div>
    </form>
  );
}

