'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { api } from '@/lib/client/api';
import { money, date, dateTime } from '@/lib/format';
import type { Invoice, InvoiceLine, Payment } from '@/lib/types';
import {
  PageHeader, Card, CardHeader, CardBody, DescriptionList,
  Button, Badge, InvoiceStatusBadge, Dialog, Field, Input, Select, Textarea,
} from '@/components/ui';

// Lazy-import the S4 Record-payment component so S3 doesn't own it.
// S4 provides this component at src/components/s4/record-payment.tsx
import dynamic from 'next/dynamic';
const RecordPayment = dynamic(
  () => import('@/components/s4/record-payment').then((m) => m.RecordPaymentDialog),
  { ssr: false },
);

type InvoiceDetail = Invoice & { lines: InvoiceLine[] };

// ---------- Cancel dialog ----------
function CancelDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancel invoice"
      description="This cannot be undone. Any reserved discount use will be released."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Back
          </Button>
          <Button variant="danger" onClick={submit} loading={saving} disabled={!reason.trim()}>
            Cancel invoice
          </Button>
        </>
      }
    >
      <Field label="Reason" required>
        {(id) => (
          <Textarea
            id={id}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. duplicate invoice"
          />
        )}
      </Field>
    </Dialog>
  );
}

// ---------- Lines table ----------
function LinesTable({ lines, discountName }: { lines: InvoiceLine[]; discountName: string | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium text-slate-600">Description</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">Qty</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">Unit price</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">Amount</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">
              Discount{discountName ? ` (${discountName})` : ''}
            </th>
            <th className="px-4 py-2.5 text-left font-medium text-slate-600">Tax</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">Tax amt</th>
            <th className="px-4 py-2.5 text-right font-medium text-slate-600">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {lines.map((l) => (
            <tr key={l.id} className={l.kind === 'plan_fee' ? 'bg-slate-50/50' : undefined}>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  {l.kind === 'plan_fee' && (
                    <Badge tone="indigo" className="shrink-0">Plan</Badge>
                  )}
                  <span className="text-slate-800">{l.description}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{l.quantity}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(l.unit_price)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{money(l.amount)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                {l.discount_amount > 0 ? `−${money(l.discount_amount)}` : '—'}
              </td>
              <td className="px-4 py-2.5 text-slate-500 text-xs">
                {l.tax_name ? `${l.tax_name} (${l.tax_rate}%)` : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                {l.tax_amount > 0 ? money(l.tax_amount) : '—'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium">{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Totals block ----------
function TotalsBlock({ inv }: { inv: Invoice }) {
  return (
    <div className="ml-auto mt-4 w-72 space-y-1.5 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-500">Subtotal</span>
        <span className="tabular-nums">{money(inv.subtotal)}</span>
      </div>
      {inv.discount_total > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span>Discount{inv.discount_name ? ` (${inv.discount_name})` : ''}</span>
          <span className="tabular-nums">−{money(inv.discount_total)}</span>
        </div>
      )}
      {inv.tax_total > 0 && (
        <div className="flex justify-between text-slate-500">
          <span>Tax</span>
          <span className="tabular-nums">{money(inv.tax_total)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{money(inv.total)}</span>
      </div>
      {inv.amount_paid > 0 && (
        <div className="flex justify-between text-slate-500">
          <span>Paid</span>
          <span className="tabular-nums">{money(inv.amount_paid)}</span>
        </div>
      )}
      <div className={`flex justify-between font-semibold ${inv.amount_due > 0 ? 'text-red-600' : 'text-slate-400'}`}>
        <span>Balance due</span>
        <span className="tabular-nums">{money(inv.amount_due)}</span>
      </div>
    </div>
  );
}

// ---------- Page ----------
export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const refresh = useRefresh();

  const { data: inv, isLoading, error, mutate } = useApi<InvoiceDetail>(`/invoices/${id}`);
  const { data: payments } = useApi<{ data: Payment[] }>(`/invoices/${id}/payments`);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const confirm = async () => {
    setActionError(null);
    try {
      await api.post(`/invoices/${id}/confirm`);
      mutate();
      refresh('/invoices');
    } catch (e: unknown) {
      const err = e as { message?: string };
      setActionError(err?.message ?? 'Failed to confirm invoice');
    }
  };

  const cancel = async (reason: string) => {
    await api.post(`/invoices/${id}/cancel`, { reason });
    mutate();
    refresh('/invoices');
  };

  const send = async () => {
    setSendingEmail(true);
    setSendStatus(null);
    try {
      const res = await api.post<{ ok: boolean; status: string; to: string }>(`/invoices/${id}/send`);
      setSendStatus(res.status === 'sent' ? `Sent to ${res.to}` : `Queued (dev mode) — no RESEND_API_KEY`);
      mutate();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setSendStatus(`Error: ${err?.message ?? 'Unknown'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  if (isLoading) return <p className="p-8 text-slate-400">Loading…</p>;
  if (error || !inv) return <p className="p-8 text-red-600">Invoice not found.</p>;

  const canConfirm = inv.status === 'draft';
  const canCancel = (inv.status === 'draft' || inv.status === 'confirmed') && inv.amount_paid === 0;
  const canSend = inv.status === 'confirmed' || inv.status === 'paid';
  const canPay = inv.status === 'confirmed';

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{inv.number}</span>
            <InvoiceStatusBadge status={inv.status} overdue={false} />
          </span>
        }
        back={{ href: '/app/invoices', label: 'Invoices' }}
        actions={
          <div className="flex flex-wrap gap-2">
            {canConfirm && (
              <Button onClick={confirm} size="sm">Confirm</Button>
            )}
            {canCancel && (
              <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel
              </Button>
            )}
            {canSend && (
              <Button variant="secondary" size="sm" onClick={send} loading={sendingEmail}>
                Send email
              </Button>
            )}
            <Link
              href={`/print/invoices/${id}`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print
            </Link>
            {canPay && (
              <RecordPayment
                invoiceId={id}
                amountDue={inv.amount_due}
                onDone={() => { mutate(); refresh('/invoices'); refresh('/payments'); }}
              />
            )}
          </div>
        }
      />

      {actionError && (
        <p className="mb-4 rounded bg-red-50 px-4 py-2 text-sm text-red-700">{actionError}</p>
      )}
      {sendStatus && (
        <p className="mb-4 rounded bg-sky-50 px-4 py-2 text-sm text-sky-800">{sendStatus}</p>
      )}

      {/* Header details */}
      <Card className="mb-4">
        <CardHeader title="Invoice details" />
        <CardBody>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bill-to */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Bill to</p>
              <p className="font-medium text-slate-900">{inv.customer_snapshot.name}</p>
              {inv.customer_snapshot.company_name && (
                <p className="text-sm text-slate-600">{inv.customer_snapshot.company_name}</p>
              )}
              <p className="text-sm text-slate-600">{inv.customer_snapshot.email}</p>
              {inv.customer_snapshot.phone && (
                <p className="text-sm text-slate-600">{inv.customer_snapshot.phone}</p>
              )}
              {inv.customer_snapshot.address && (
                <p className="text-sm text-slate-500">{inv.customer_snapshot.address}</p>
              )}
              {inv.customer_snapshot.gstin && (
                <p className="text-xs text-slate-400">GSTIN: {inv.customer_snapshot.gstin}</p>
              )}
            </div>

            {/* Dates & terms */}
            <DescriptionList
              items={[
                { label: 'Invoice date', value: date(inv.invoice_date) },
                { label: 'Due date', value: date(inv.due_date) },
                { label: 'Period', value: `${date(inv.period_start)} – ${date(inv.period_end)}` },
                { label: 'Payment terms', value: inv.payment_term_name ?? '—' },
                { label: 'Confirmed', value: inv.confirmed_at ? dateTime(inv.confirmed_at) : '—' },
                { label: 'Sent', value: inv.sent_at ? dateTime(inv.sent_at) : '—' },
              ]}
            />
          </div>
        </CardBody>
      </Card>

      {/* Lines */}
      <Card className="mb-4">
        <CardHeader title="Invoice lines" />
        <LinesTable lines={inv.lines} discountName={inv.discount_name} />
        <CardBody>
          <TotalsBlock inv={inv} />
        </CardBody>
      </Card>

      {/* Payments */}
      {payments && payments.data.length > 0 && (
        <Card>
          <CardHeader title="Payments" />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Method</th>
                  <th className="px-4 py-2.5 text-right font-medium text-slate-600">Amount</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-600">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {payments.data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5">{date(p.paid_on)}</td>
                    <td className="px-4 py-2.5 capitalize">{p.method.replace('_', ' ')}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-700">{money(p.amount)}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CancelDialog open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancel} />
    </div>
  );
}
