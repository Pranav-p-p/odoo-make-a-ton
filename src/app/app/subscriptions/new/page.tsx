'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  ButtonLink,
  Input,
  Select,
  Textarea,
  Field,
  Badge,
} from '@/components/ui';
import { useApi } from '@/lib/client/hooks';
import { api, ApiClientError } from '@/lib/client/api';
import type { Customer, Plan, PaymentTerm, Product, QuoteTemplate, QuoteTemplateLine, ProductVariant, Subscription } from '@/lib/types';
import { money, today } from '@/lib/format';

interface OptionsResponse {
  customers: Customer[];
  plans: Plan[];
  payment_terms: PaymentTerm[];
  templates: (QuoteTemplate & { lines: QuoteTemplateLine[] })[];
  products: (Product & { variants: ProductVariant[] })[];
}

interface CustomLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  unit_price: number;
  description: string | null;
}

export default function NewSubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomer = searchParams.get('customer_id') || '';

  const { data: options, isLoading } = useApi<OptionsResponse>('/subscriptions/options');

  const [mode, setMode] = useState<'template' | 'blank'>('template');
  const [customerId, setCustomerId] = useState(preselectedCustomer);
  const [templateId, setTemplateId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState('');
  const [paymentTermId, setPaymentTermId] = useState('');
  const [notes, setNotes] = useState('');

  // Custom lines for blank mode
  const [lines, setLines] = useState<CustomLine[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Set default template and plan when options load
  const selectedTemplate = useMemo(
    () => options?.templates.find((t) => t.id === templateId) || options?.templates[0] || null,
    [options, templateId],
  );

  const selectedPlan = useMemo(() => {
    if (mode === 'template' && selectedTemplate) {
      return options?.plans.find((p) => p.id === selectedTemplate.plan_id) || null;
    }
    return options?.plans.find((p) => p.id === planId) || options?.plans[0] || null;
  }, [options, mode, selectedTemplate, planId]);

  // Add line to blank subscription
  const handleAddLine = () => {
    if (!options?.products.length) return;
    const firstProd = options.products[0];
    const firstVar = firstProd.variants?.[0] || null;
    const basePrice = firstProd.sales_price + (firstVar ? firstVar.extra_price : 0);

    const newLine: CustomLine = {
      id: Math.random().toString(36).slice(2),
      product_id: firstProd.id,
      variant_id: firstVar ? firstVar.id : null,
      quantity: 1,
      unit_price: basePrice,
      description: null,
    };
    setLines([...lines, newLine]);
  };

  const handleUpdateLine = (id: string, updates: Partial<CustomLine>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, ...updates };
        if (updates.product_id && updates.product_id !== l.product_id) {
          const prod = options?.products.find((p) => p.id === updates.product_id);
          const firstVar = prod?.variants?.[0] || null;
          updated.variant_id = firstVar ? firstVar.id : null;
          updated.unit_price = (prod?.sales_price ?? 0) + (firstVar ? firstVar.extra_price : 0);
        } else if (updates.variant_id !== undefined && updates.variant_id !== l.variant_id) {
          const prod = options?.products.find((p) => p.id === updated.product_id);
          const v = prod?.variants?.find((varItem) => varItem.id === updates.variant_id);
          updated.unit_price = (prod?.sales_price ?? 0) + (v ? v.extra_price : 0);
        }
        return updated;
      }),
    );
  };

  const handleRemoveLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  // Calculate totals
  const linesTotal = useMemo(() => {
    if (mode === 'template' && selectedTemplate && options?.products) {
      return selectedTemplate.lines.reduce((sum, l) => {
        const prod = options.products.find((p) => p.id === l.product_id);
        const variant = prod?.variants?.find((v) => v.id === l.variant_id);
        const price = (prod?.sales_price ?? 0) + (variant?.extra_price ?? 0);
        return sum + price * l.quantity;
      }, 0);
    }
    return lines.reduce((sum, l) => sum + (l.unit_price || 0) * (l.quantity || 0), 0);
  }, [mode, selectedTemplate, options, lines]);

  const planPrice = selectedPlan?.price ?? 0;
  const recurringTotal = planPrice + linesTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGlobalError(null);

    const actualCustomerId = customerId || options?.customers[0]?.id;
    if (!actualCustomerId) {
      setGlobalError('Please select a customer');
      setSubmitting(false);
      return;
    }

    try {
      let createdSub: Subscription;
      if (mode === 'template') {
        const tId = templateId || selectedTemplate?.id;
        if (!tId) throw new Error('Please select a quotation template');
        createdSub = await api.post<Subscription>('/subscriptions', {
          from_template_id: tId,
          customer_id: actualCustomerId,
          start_date: startDate,
          expiry_date: expiryDate || null,
          payment_term_id: paymentTermId || null,
        });
      } else {
        const pId = planId || selectedPlan?.id;
        if (!pId) throw new Error('Please select a plan');
        createdSub = await api.post<Subscription>('/subscriptions', {
          customer_id: actualCustomerId,
          plan_id: pId,
          start_date: startDate,
          expiry_date: expiryDate || null,
          payment_term_id: paymentTermId || null,
          notes: notes || null,
          lines: lines.map((l) => ({
            product_id: l.product_id,
            variant_id: l.variant_id || null,
            quantity: l.quantity,
            unit_price: l.unit_price,
            description: l.description || null,
          })),
        });
      }

      router.push(`/app/subscriptions/${createdSub.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        setGlobalError(err.message);
      } else if (err instanceof Error) {
        setGlobalError(err.message);
      } else {
        setGlobalError('Failed to create subscription');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <Card className="h-96 animate-pulse bg-slate-100"><div className="p-6" /></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/app/subscriptions', label: 'Subscriptions' }}
        title="New subscription"
        description="Turn an offer into an active subscription using a quotation template or custom plan."
      />

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {globalError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {globalError}
            </div>
          )}

          {/* Creation Mode Toggle */}
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMode('template')}
                  className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
                    mode === 'template'
                      ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">From quotation template</span>
                    <Badge tone="blue">Recommended</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Prefabricated offer with pre-configured plan, items, and validities.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('blank')}
                  className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
                    mode === 'blank'
                      ? 'border-brand-600 bg-brand-50/50 ring-2 ring-brand-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Custom / blank plan</span>
                    <Badge tone="gray">Flexible</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Pick any billing plan and add arbitrary product lines manually.
                  </p>
                </button>
              </div>
            </CardBody>
          </Card>

          {/* General Information */}
          <Card>
            <CardHeader title="Subscription setup" />
            <CardBody className="space-y-4">
              <Field label="Customer" required error={errors.customer_id}>
                {(id) => (
                  <Select
                    id={id}
                    value={customerId || (options?.customers[0]?.id ?? '')}
                    onChange={(e) => setCustomerId(e.target.value)}
                    required
                  >
                    {options?.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company_name ? `(${c.company_name})` : ''} — {c.email}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              {mode === 'template' ? (
                <Field label="Quotation template" required error={errors.from_template_id}>
                  {(id) => (
                    <Select
                      id={id}
                      value={templateId || (selectedTemplate?.id ?? '')}
                      onChange={(e) => setTemplateId(e.target.value)}
                      required
                    >
                      {options?.templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Valid {t.validity_days} days)
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : (
                <Field label="Billing plan" required error={errors.plan_id}>
                  {(id) => (
                    <Select
                      id={id}
                      value={planId || (selectedPlan?.id ?? '')}
                      onChange={(e) => setPlanId(e.target.value)}
                      required
                    >
                      {options?.plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {money(p.price)} / {p.billing_period} (Min qty: {p.min_quantity})
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Start date" required error={errors.start_date}>
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  )}
                </Field>

                <Field label="Expiry date" error={errors.expiry_date} hint="Leave empty for open-ended">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  )}
                </Field>

                <Field label="Payment terms" error={errors.payment_term_id}>
                  {(id) => (
                    <Select
                      id={id}
                      value={paymentTermId}
                      onChange={(e) => setPaymentTermId(e.target.value)}
                    >
                      <option value="">No terms (default)</option>
                      {options?.payment_terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.days} days)
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              {mode === 'blank' && (
                <Field label="Notes" error={errors.notes}>
                  {(id) => (
                    <Textarea
                      id={id}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Internal subscription or quotation notes..."
                      rows={2}
                    />
                  )}
                </Field>
              )}
            </CardBody>
          </Card>

          {/* Product Lines */}
          <Card>
            <CardHeader
              title="Product lines"
              description={
                mode === 'template'
                  ? 'Lines prefilled and snapshotted from the selected quotation template.'
                  : 'Add products and variants to this subscription.'
              }
              actions={
                mode === 'blank' && (
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddLine}>
                    + Add line
                  </Button>
                )
              }
            />
            <CardBody className="p-0">
              {mode === 'template' ? (
                <div className="divide-y divide-slate-100">
                  {selectedTemplate?.lines.map((l, idx) => {
                    const prod = options?.products.find((p) => p.id === l.product_id);
                    const variant = prod?.variants?.find((v) => v.id === l.variant_id);
                    const unitPrice = (prod?.sales_price ?? 0) + (variant?.extra_price ?? 0);
                    const total = unitPrice * l.quantity;

                    return (
                      <div key={l.id || idx} className="flex items-center justify-between p-4 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">
                            {prod?.name}{' '}
                            {variant && (
                              <span className="text-xs text-brand-600 font-normal">
                                ({variant.attribute}: {variant.value} +{money(variant.extra_price)})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            Quantity: {l.quantity} × {money(unitPrice)}
                          </div>
                        </div>
                        <div className="font-medium tabular-nums text-slate-800">
                          {money(total)}
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedTemplate || selectedTemplate.lines.length === 0) && (
                    <div className="p-8 text-center text-sm text-slate-500">
                      This template has no product lines.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {lines.map((line, idx) => {
                    const prod = options?.products.find((p) => p.id === line.product_id);
                    const hasVariants = (prod?.variants?.length ?? 0) > 0;

                    return (
                      <div key={line.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                        <div className="flex-1 min-w-[160px]">
                          <label className="block text-xs font-medium text-slate-700">Product</label>
                          <Select
                            value={line.product_id}
                            onChange={(e) => handleUpdateLine(line.id, { product_id: e.target.value })}
                            className="h-9 text-xs mt-1"
                          >
                            {options?.products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.type})
                              </option>
                            ))}
                          </Select>
                        </div>

                        {hasVariants && (
                          <div className="w-40">
                            <label className="block text-xs font-medium text-slate-700">Variant</label>
                            <Select
                              value={line.variant_id || ''}
                              onChange={(e) => handleUpdateLine(line.id, { variant_id: e.target.value || null })}
                              className="h-9 text-xs mt-1"
                            >
                              <option value="">Default (No variant)</option>
                              {prod?.variants?.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.attribute}: {v.value} (+{v.extra_price})
                                </option>
                              ))}
                            </Select>
                          </div>
                        )}

                        <div className="w-24">
                          <label className="block text-xs font-medium text-slate-700">Quantity</label>
                          <Input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => handleUpdateLine(line.id, { quantity: Number(e.target.value) || 1 })}
                            className="h-9 text-xs mt-1"
                          />
                        </div>

                        <div className="w-32">
                          <label className="block text-xs font-medium text-slate-700">Unit price</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={line.unit_price}
                            onChange={(e) => handleUpdateLine(line.id, { unit_price: Number(e.target.value) || 0 })}
                            className="h-9 text-xs mt-1"
                          />
                        </div>

                        <div className="w-28 text-right pb-2">
                          <span className="block text-xs text-slate-500">Amount</span>
                          <span className="text-sm font-semibold tabular-nums text-slate-900">
                            {money(line.unit_price * line.quantity)}
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(line.id)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 h-9 px-2"
                        >
                          ✕
                        </Button>
                      </div>
                    );
                  })}

                  {lines.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                      No custom lines added yet. Click &ldquo;+ Add line&rdquo; to add product seats or addons.
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Order summary" />
            <CardBody className="space-y-4">
              <div>
                <span className="text-xs font-medium uppercase text-slate-400">Plan</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="font-semibold text-slate-900">{selectedPlan?.name ?? '—'}</span>
                  <span className="font-medium tabular-nums text-slate-700">{money(planPrice)}</span>
                </div>
                {selectedPlan && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Billed every {selectedPlan.billing_period}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs font-medium uppercase text-slate-400">Product lines</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm text-slate-700">Lines total</span>
                  <span className="font-medium tabular-nums text-slate-700">{money(linesTotal)}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-sm font-semibold text-slate-900">Recurring total</span>
                    <p className="text-xs text-slate-500">Before taxes &amp; discounts</p>
                  </div>
                  <span className="text-xl font-bold tabular-nums text-brand-600">
                    {money(recurringTotal)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={submitting} className="w-full justify-center">
                  {submitting ? 'Creating...' : 'Create subscription (Draft)'}
                </Button>
                <div className="mt-2 text-center">
                  <ButtonLink href="/app/subscriptions" variant="ghost" size="sm">
                    Cancel
                  </ButtonLink>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </form>
    </div>
  );
}
