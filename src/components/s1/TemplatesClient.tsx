'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useApiList, useApi } from '@/lib/client/hooks';
import { api, type ApiClientError } from '@/lib/client/api';
import {
  PageHeader, SearchInput, Badge, DataTable, type Column,
  Button, ButtonLink, Pagination, EmptyState, Field, Input,
  Select, Textarea, Card, CardHeader, CardBody,
} from '@/components/ui';
import { money } from '@/lib/format';
import type { QuoteTemplate, Plan, Product, ProductVariant } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface TemplateLine {
  id?: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  // Enriched for display
  product?: Product;
  variant?: ProductVariant;
}

// ── Template list ─────────────────────────────────────────────────────────────

export function TemplatesClient({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const handleSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const { data, isLoading } = useApiList<QuoteTemplate>('/quote-templates', {
    page,
    page_size: 20,
    q: q || undefined,
    active: showArchived ? 'all' : 'true',
  });

  const columns: Column<QuoteTemplate>[] = [
    { key: 'name', header: 'Name', cell: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
    { key: 'plan', header: 'Plan', cell: (r) => <span className="text-slate-700">{(r as { plan?: { name: string } }).plan?.name ?? '—'}</span> },
    { key: 'validity', header: 'Valid for', cell: (r) => <span>{r.validity_days} days</span> },
    { key: 'lines', header: 'Lines', align: 'center', cell: (r) => <Badge tone="gray">{r.lines?.length ?? 0}</Badge> },
    {
      key: 'status', header: 'Status',
      cell: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Archived'}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Quotation templates"
        description="Reusable templates to quickly create subscriptions."
        actions={isAdmin ? <ButtonLink href="/app/templates/new" variant="primary">+ New template</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput onSearch={handleSearch} placeholder="Search templates…" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white">
        {data?.data?.length === 0 && !isLoading ? (
          <EmptyState title="No templates found" action={isAdmin ? <ButtonLink href="/app/templates/new" variant="secondary">New template</ButtonLink> : undefined} />
        ) : (
          <DataTable rows={data?.data} columns={columns} loading={isLoading} rowHref={(r) => `/app/templates/${r.id}`} />
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

// ── Line editor ──────────────────────────────────────────────────────────────

function LineEditor({
  lines, onChange, products, isAdmin,
}: {
  lines: TemplateLine[];
  onChange: (lines: TemplateLine[]) => void;
  products: Product[];
  isAdmin: boolean;
}) {
  function updateLine(i: number, patch: Partial<TemplateLine>) {
    const next = lines.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, ...patch };
      // Reset variant when product changes
      if (patch.product_id && patch.product_id !== l.product_id) updated.variant_id = null;
      return updated;
    });
    onChange(next);
  }

  function addLine() {
    onChange([...lines, { product_id: '', variant_id: null, quantity: 1 }]);
  }

  function removeLine(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const product = products.find((p) => p.id === line.product_id);
        const variants = product?.variants ?? [];
        const variant = variants.find((v) => v.id === line.variant_id);
        const unitPrice = (product?.sales_price ?? 0) + (variant?.extra_price ?? 0);

        return (
          <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <Field label="Product" required className="min-w-48 flex-1">
              {(id) => (
                <Select id={id} value={line.product_id} onChange={(e) => updateLine(i, { product_id: e.target.value })} disabled={!isAdmin}>
                  <option value="">— Select product —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              )}
            </Field>

            {variants.length > 0 && (
              <Field label="Variant" className="min-w-36">
                {(id) => (
                  <Select id={id} value={line.variant_id ?? ''} onChange={(e) => updateLine(i, { variant_id: e.target.value || null })} disabled={!isAdmin}>
                    <option value="">— Base —</option>
                    {variants.map((v) => <option key={v.id} value={v.id}>{v.attribute}: {v.value} (+{money(v.extra_price)})</option>)}
                  </Select>
                )}
              </Field>
            )}

            <Field label="Qty" required className="w-20">
              {(id) => (
                <Input id={id} type="number" min={1} step={0.01} value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} disabled={!isAdmin} />
              )}
            </Field>

            <div className="flex flex-col items-end gap-1 pb-0.5">
              <span className="text-xs text-slate-500">Unit price</span>
              <span className="font-medium text-slate-800">{product ? money(unitPrice) : '—'}</span>
            </div>

            {isAdmin && (
              <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)} className="mb-0.5 text-red-600 hover:text-red-700">Remove</Button>
            )}
          </div>
        );
      })}

      {isAdmin && (
        <Button type="button" size="sm" variant="secondary" onClick={addLine}>+ Add line</Button>
      )}
    </div>
  );
}

// ── Template form ─────────────────────────────────────────────────────────────

export function TemplateForm({ initial, isAdmin }: { initial?: QuoteTemplate & { lines?: TemplateLine[] }; isAdmin: boolean }) {
  const router = useRouter();
  const isEdit = !!initial;

  const [name, setName] = useState(initial?.name ?? '');
  const [planId, setPlanId] = useState(initial?.plan_id ?? '');
  const [validityDays, setValidityDays] = useState(initial ? String(initial.validity_days) : '30');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [lines, setLines] = useState<TemplateLine[]>(initial?.lines ?? []);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const { data: planData } = useApiList<Plan>('/plans', { page_size: 100 });
  const { data: productData } = useApiList<Product>('/products', { page_size: 100 });
  const plans = planData?.data ?? [];
  const products = productData?.data ?? [];

  // Fetch full plan to get its price
  const { data: selectedPlan } = useApi<Plan>(planId ? `/plans/${planId}` : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrors({});
    if (lines.length === 0) { setErrors({ lines: ['At least one product line is required'] }); setSaving(false); return; }
    if (lines.some((l) => !l.product_id)) { setErrors({ lines: ['All lines must have a product selected'] }); setSaving(false); return; }

    const body = {
      name: name.trim(),
      plan_id: planId,
      validity_days: Number(validityDays),
      notes: notes.trim() || null,
      lines: lines.map((l) => ({ product_id: l.product_id, variant_id: l.variant_id ?? null, quantity: l.quantity })),
    };
    try {
      if (isEdit) {
        await api.patch(`/quote-templates/${initial!.id}`, body);
        router.refresh();
      } else {
        const res = await api.post<QuoteTemplate>('/quote-templates', body);
        router.push(`/app/templates/${res.id}`);
      }
    } catch (e) {
      const err = e as ApiClientError;
      setErrors(err.fieldErrors ?? { _: [err.message] });
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm(`Archive "${name}"?`)) return;
    try { await api.patch(`/quote-templates/${initial!.id}`, { is_active: false }); router.push('/app/templates'); }
    catch (e) { alert((e as ApiClientError).message); }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {errors._ && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errors._[0]}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Template name" required error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Starter · 5 Odoo seats" aria-invalid={!!errors.name} disabled={!isAdmin} />}
        </Field>
        <Field label="Plan" required error={errors.plan_id}>
          {(id) => (
            <Select id={id} value={planId} onChange={(e) => setPlanId(e.target.value)} disabled={!isAdmin}>
              <option value="">— Select plan —</option>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Validity (days)" required error={errors.validity_days} hint="Days a quote created from this template stays valid">
          {(id) => <Input id={id} type="number" min={1} max={365} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} disabled={!isAdmin} />}
        </Field>
        {selectedPlan && (
          <div className="sm:col-span-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Plan fee: <span className="font-medium text-slate-900">{money(selectedPlan.price)}</span> / {selectedPlan.billing_period}
          </div>
        )}
        <Field label="Notes" className="sm:col-span-2" error={errors.notes}>
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={2} disabled={!isAdmin} />}
        </Field>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">Product lines <span className="text-red-600">*</span></p>
        {errors.lines && <p className="mb-2 text-sm text-red-600">{errors.lines[0]}</p>}
        <LineEditor lines={lines} onChange={setLines} products={products} isAdmin={isAdmin} />
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {isAdmin && <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create template'}</Button>}
          <ButtonLink href="/app/templates" variant="ghost">Cancel</ButtonLink>
        </div>
        {isEdit && isAdmin && initial?.is_active && (
          <Button type="button" variant="ghost" onClick={archive} className="text-red-600 hover:text-red-700">Archive</Button>
        )}
      </div>
    </form>
  );
}

