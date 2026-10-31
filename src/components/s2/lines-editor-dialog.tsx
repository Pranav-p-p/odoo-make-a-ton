'use client';

import { useState, useEffect } from 'react';
import { Dialog, Button, Input, Select } from '@/components/ui';
import { api, ApiClientError } from '@/lib/client/api';
import type { SubscriptionLine, Product, ProductVariant } from '@/lib/types';
import { money } from '@/lib/format';

interface EditableLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  description: string | null;
}

interface LinesEditorProps {
  open: boolean;
  onClose: () => void;
  subscriptionId: string;
  initialLines: SubscriptionLine[];
  products: (Product & { variants: ProductVariant[] })[];
  onSuccess: () => void;
}

export function LinesEditorDialog({
  open,
  onClose,
  subscriptionId,
  initialLines,
  products,
  onSuccess,
}: LinesEditorProps) {
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLines.length > 0) {
      setLines(
        initialLines.map((l) => ({
          id: l.id,
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          description: l.description,
        })),
      );
    } else {
      setLines([]);
    }
    setError(null);
  }, [initialLines, open]);

  const handleAddLine = () => {
    if (!products.length) return;
    const firstProd = products[0];
    const firstVar = firstProd.variants?.[0] || null;
    const price = firstProd.sales_price + (firstVar ? firstVar.extra_price : 0);

    const newLine: EditableLine = {
      id: Math.random().toString(36).slice(2),
      product_id: firstProd.id,
      variant_id: firstVar ? firstVar.id : null,
      quantity: 1,
      unit_price: price,
      description: null,
    };
    setLines([...lines, newLine]);
  };

  const handleUpdate = (id: string, updates: Partial<EditableLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        if (updates.product_id && updates.product_id !== l.product_id) {
          const prod = products.find((p) => p.id === updates.product_id);
          const firstVar = prod?.variants?.[0] || null;
          updated.variant_id = firstVar ? firstVar.id : null;
          updated.unit_price = (prod?.sales_price ?? 0) + (firstVar ? firstVar.extra_price : 0);
        } else if (updates.variant_id !== undefined && updates.variant_id !== l.variant_id) {
          const prod = products.find((p) => p.id === updated.product_id);
          const v = prod?.variants?.find((varItem) => varItem.id === updates.variant_id);
          updated.unit_price = (prod?.sales_price ?? 0) + (v ? v.extra_price : 0);
        }
        return updated;
      }),
    );
  };

  const handleRemove = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      lines: lines.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        description: l.description || null,
      })),
    };

    try {
      await api.put(`/subscriptions/${subscriptionId}/lines`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save subscription lines');
      }
    } finally {
      setSaving(false);
    }
  };

  const total = lines.reduce((sum, l) => sum + (l.unit_price || 0) * (l.quantity || 0), 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit product lines"
      description="Update quantities, variants or add/remove items. Changes apply from the next invoice."
      footer={
        <div className="flex w-full items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Total: <span className="tabular-nums text-brand-600">{money(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="lines-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save lines'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="lines-form" onSubmit={handleSubmit} className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {lines.map((line) => {
            const prod = products.find((p) => p.id === line.product_id);
            const hasVariants = (prod?.variants?.length ?? 0) > 0;

            return (
              <div key={line.id} className="flex flex-wrap items-end gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-slate-600 font-medium">Product</label>
                  <Select
                    value={line.product_id}
                    onChange={(e) => handleUpdate(line.id, { product_id: e.target.value })}
                    className="h-8 text-xs mt-1"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                {hasVariants && (
                  <div className="w-36">
                    <label className="block text-slate-600 font-medium">Variant</label>
                    <Select
                      value={line.variant_id || ''}
                      onChange={(e) => handleUpdate(line.id, { variant_id: e.target.value || null })}
                      className="h-8 text-xs mt-1"
                    >
                      <option value="">Default</option>
                      {prod?.variants?.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.attribute}: {v.value} (+{v.extra_price})
                        </option>
                      ))}
                    </Select>
                  </div>
                )}

                <div className="w-20">
                  <label className="block text-slate-600 font-medium">Qty</label>
                  <Input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => handleUpdate(line.id, { quantity: Number(e.target.value) || 1 })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div className="w-28">
                  <label className="block text-slate-600 font-medium">Unit price</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.unit_price}
                    onChange={(e) => handleUpdate(line.id, { unit_price: Number(e.target.value) || 0 })}
                    className="h-8 text-xs mt-1"
                  />
                </div>

                <div className="w-24 text-right pb-1.5">
                  <span className="block text-slate-500 text-[10px]">Total</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {money(line.unit_price * line.quantity)}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(line.id)}
                  className="h-8 px-2 text-red-600 hover:bg-red-50"
                >
                  ✕
                </Button>
              </div>
            );
          })}

          {lines.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No lines on this subscription.
            </div>
          )}
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={handleAddLine} className="w-full">
          + Add product line
        </Button>
      </form>
    </Dialog>
  );
}
