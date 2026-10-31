'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ApiClientError } from '@/lib/client/api';
import { useApiList } from '@/lib/client/hooks';
import {
  Button, ButtonLink, Field, Input, Select, Textarea,
  Card, CardHeader, CardBody, PageHeader, Badge,
} from '@/components/ui';
import { money } from '@/lib/format';
import type { Product, ProductVariant, Tax } from '@/lib/types';

// ── Variant row (inline add / edit / delete) ──────────────────────────────────

function VariantRow({
  variant, salesPrice, isAdmin, productId, onSaved,
}: {
  variant: ProductVariant;
  salesPrice: number;
  isAdmin: boolean;
  productId: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [attribute, setAttribute] = useState(variant.attribute);
  const [value, setValue] = useState(variant.value);
  const [extra, setExtra] = useState(String(variant.extra_price));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      await api.patch(`/products/${productId}/variants/${variant.id}`, {
        attribute: attribute.trim(), value: value.trim(), extra_price: Number(extra),
      });
      onSaved(); setEditing(false);
    } catch (e) { setError((e as ApiClientError).message); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm(`Delete variant ${variant.attribute}: ${variant.value}?`)) return;
    try {
      await api.del(`/products/${productId}/variants/${variant.id}`);
      onSaved();
    } catch (e) { alert((e as ApiClientError).message); }
  }

  const finalPrice = salesPrice + Number(extra || 0);

  if (editing) {
    return (
      <tr className="bg-brand-50">
        <td className="px-4 py-2">
          <Input value={attribute} onChange={(e) => setAttribute(e.target.value)} className="h-8 text-sm" autoFocus />
        </td>
        <td className="px-4 py-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="h-8 text-sm" />
        </td>
        <td className="px-4 py-2">
          <Input type="number" min={0} step={0.01} value={extra} onChange={(e) => setExtra(e.target.value)} className="h-8 w-24 text-sm" />
        </td>
        <td className="px-4 py-2 text-right text-sm text-slate-500">{money(finalPrice)}</td>
        <td className="px-4 py-2 text-right">
          {error && <span className="mr-2 text-xs text-red-600">{error}</span>}
          <Button size="sm" onClick={save} loading={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setAttribute(variant.attribute); setValue(variant.value); setExtra(String(variant.extra_price)); }} className="ml-1">Cancel</Button>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-4 py-2.5 text-sm text-slate-800">{variant.attribute}</td>
      <td className="px-4 py-2.5 text-sm text-slate-800">{variant.value}</td>
      <td className="px-4 py-2.5 text-sm text-slate-800">{money(variant.extra_price)}</td>
      <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-900">{money(salesPrice + variant.extra_price)}</td>
      <td className="px-4 py-2.5 text-right">
        {isAdmin && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
            <Button size="sm" variant="ghost" onClick={remove} className="text-red-600 hover:text-red-700">Delete</Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Add Variant row ───────────────────────────────────────────────────────────

function AddVariantRow({ productId, salesPrice, onSaved }: { productId: string; salesPrice: number; onSaved: () => void }) {
  const [attribute, setAttribute] = useState('');
  const [value, setValue] = useState('');
  const [extra, setExtra] = useState('0');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function save(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErrors({});
    try {
      await api.post(`/products/${productId}/variants`, {
        attribute: attribute.trim(), value: value.trim(), extra_price: Number(extra),
      });
      setAttribute(''); setValue(''); setExtra('0');
      onSaved();
    } catch (e) {
      const err = e as ApiClientError;
      setErrors(err.fieldErrors ?? { _: [err.message] });
    } finally { setSaving(false); }
  }

  const finalPrice = salesPrice + Number(extra || 0);

  return (
    <tr className="border-t border-dashed border-slate-200 bg-slate-50">
      <td className="px-4 py-2">
        <Input value={attribute} onChange={(e) => setAttribute(e.target.value)} placeholder="e.g. Brand" className="h-8 text-sm" aria-invalid={!!errors.attribute} />
        {errors.attribute && <p className="mt-0.5 text-xs text-red-600">{errors.attribute[0]}</p>}
      </td>
      <td className="px-4 py-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Odoo" className="h-8 text-sm" aria-invalid={!!errors.value} />
        {errors.value && <p className="mt-0.5 text-xs text-red-600">{errors.value[0]}</p>}
      </td>
      <td className="px-4 py-2">
        <Input type="number" min={0} step={0.01} value={extra} onChange={(e) => setExtra(e.target.value)} className="h-8 w-24 text-sm" aria-invalid={!!errors.extra_price} />
        {errors.extra_price && <p className="mt-0.5 text-xs text-red-600">{errors.extra_price[0]}</p>}
      </td>
      <td className="px-4 py-2 text-right text-sm font-medium text-slate-600">{money(finalPrice)}</td>
      <td className="px-4 py-2 text-right">
        {errors._ && <span className="mr-2 text-xs text-red-600">{errors._[0]}</span>}
        <Button size="sm" onClick={save} loading={saving}>Add</Button>
      </td>
    </tr>
  );
}

// ── Variants table ────────────────────────────────────────────────────────────

function VariantsTable({ product, isAdmin, onSaved }: { product: Product; isAdmin: boolean; onSaved: () => void }) {
  const variants = product.variants ?? [];

  return (
    <Card>
      <CardHeader title="Variants" description="Price variants for this product (e.g. by brand or tier)." />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Attribute</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Value</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-600">Extra price</th>
              <th className="px-4 py-2.5 text-right font-medium text-slate-600">Final price</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {variants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  No variants yet. Add one below.
                </td>
              </tr>
            )}
            {variants.map((v) => (
              <VariantRow
                key={v.id}
                variant={v}
                salesPrice={product.sales_price}
                isAdmin={isAdmin}
                productId={product.id}
                onSaved={onSaved}
              />
            ))}
            {isAdmin && (
              <AddVariantRow productId={product.id} salesPrice={product.sales_price} onSaved={onSaved} />
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Product form (create & edit) ──────────────────────────────────────────────

export function ProductForm({
  initial,
  isAdmin,
  onSuccess,
}: {
  initial?: Product;
  isAdmin: boolean;
  onSuccess?: (id: string) => void;
}) {
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'service');
  const [salesPrice, setSalesPrice] = useState(initial ? String(initial.sales_price) : '');
  const [costPrice, setCostPrice] = useState(initial ? String(initial.cost_price) : '0');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [taxId, setTaxId] = useState(initial?.default_tax_id ?? '');
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const { data: taxData } = useApiList<Tax>('/taxes', { page_size: 100 });
  const taxes = taxData?.data ?? [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErrors({});
    const body = {
      name: name.trim(),
      type,
      sales_price: Number(salesPrice),
      cost_price: Number(costPrice),
      notes: notes.trim() || null,
      default_tax_id: taxId || null,
    };
    try {
      if (isEdit) {
        await api.patch(`/products/${initial!.id}`, body);
        onSuccess?.(initial!.id);
      } else {
        const res = await api.post<Product>('/products', body);
        onSuccess?.(res.id);
        router.push(`/app/products/${res.id}`);
      }
    } catch (e) {
      const err = e as ApiClientError;
      setErrors(err.fieldErrors ?? { _: [err.message] });
    } finally { setSaving(false); }
  }

  async function archive() {
    if (!confirm(`Archive "${name}"? Existing subscriptions are not affected.`)) return;
    setArchiving(true);
    try {
      await api.patch(`/products/${initial!.id}`, { is_active: false });
      router.push('/app/products');
    } catch (e) { alert((e as ApiClientError).message); }
    finally { setArchiving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {errors._ && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{errors._[0]}</p>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" required error={errors.name} className="sm:col-span-2">
          {(id) => (
            <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Odoo Seat" aria-invalid={!!errors.name} />
          )}
        </Field>

        <Field label="Type" required error={errors.type}>
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="service">Service</option>
              <option value="software">Software</option>
              <option value="addon">Add-on</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>

        <Field label="Default tax" error={errors.default_tax_id}>
          {(id) => (
            <Select id={id} value={taxId} onChange={(e) => setTaxId(e.target.value)}>
              <option value="">— None —</option>
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.rate_percent}%)</option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Sales price (₹)" required error={errors.sales_price}>
          {(id) => (
            <Input id={id} type="number" min={0} step={0.01} value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} placeholder="0.00" aria-invalid={!!errors.sales_price} />
          )}
        </Field>

        <Field label="Cost price (₹)" error={errors.cost_price}>
          {(id) => (
            <Input id={id} type="number" min={0} step={0.01} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" aria-invalid={!!errors.cost_price} />
          )}
        </Field>

        <Field label="Notes" className="sm:col-span-2" error={errors.notes}>
          {(id) => (
            <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={3} />
          )}
        </Field>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {isAdmin && (
            <Button type="submit" loading={saving}>{isEdit ? 'Save changes' : 'Create product'}</Button>
          )}
          <ButtonLink href="/app/products" variant="ghost">Cancel</ButtonLink>
        </div>
        {isEdit && isAdmin && initial?.is_active && (
          <Button type="button" variant="ghost" loading={archiving} onClick={archive} className="text-red-600 hover:text-red-700">
            Archive
          </Button>
        )}
      </div>
    </form>
  );
}

// ── Product detail page (edit + variants) ─────────────────────────────────────

export function ProductDetailClient({ product: initial, isAdmin }: { product: Product; isAdmin: boolean }) {
  const [product, setProduct] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function refreshProduct() {
    const updated = await api.get<Product>(`/products/${product.id}`);
    setProduct(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        back={{ href: '/app/products', label: 'Products' }}
        actions={
          <div className="flex items-center gap-2">
            {!product.is_active && <Badge tone="gray">Archived</Badge>}
            {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
          </div>
        }
      />

      <Card>
        <CardHeader title="Product details" />
        <CardBody>
          <ProductForm
            initial={product}
            isAdmin={isAdmin}
            onSuccess={refreshProduct}
          />
        </CardBody>
      </Card>

      <VariantsTable product={product} isAdmin={isAdmin} onSaved={refreshProduct} />
    </div>
  );
}

