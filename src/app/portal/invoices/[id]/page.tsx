'use client';

import { use, useEffect, useState } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  DescriptionList,
  DataTable,
  ButtonLink,
  InvoiceStatusBadge,
  type Column,
} from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import type { Invoice, InvoiceLine } from '@/lib/types';
import { date, money } from '@/lib/format';

export default function PortalInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const [invRes, linesRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).maybeSingle(),
        supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('sort_order'),
      ]);

      if (invRes.error || !invRes.data || invRes.data.status === 'draft') {
        setError('Invoice not found or access denied');
      } else {
        setInvoice(invRes.data as Invoice);
        setLines((linesRes.data ?? []) as InvoiceLine[]);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <Card className="h-96 animate-pulse bg-slate-100"><div className="p-6" /></Card>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <h3 className="font-semibold">Invoice not found</h3>
        <p className="mt-1 text-sm text-red-600">{error || 'This invoice does not exist or is not available in the portal.'}</p>
        <div className="mt-4">
          <ButtonLink href="/portal/invoices" variant="secondary">
            Back to my invoices
          </ButtonLink>
        </div>
      </div>
    );
  }

  const lineColumns: Column<InvoiceLine>[] = [
    {
      key: 'description',
      header: 'Item',
      cell: (r) => <span className="font-medium text-slate-800">{r.description}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      cell: (r) => <span className="tabular-nums">{r.quantity}</span>,
      align: 'right',
    },
    {
      key: 'unit_price',
      header: 'Unit price',
      cell: (r) => <span className="tabular-nums text-slate-600">{money(r.unit_price)}</span>,
      align: 'right',
    },
    {
      key: 'discount_amount',
      header: 'Discount',
      cell: (r) => <span className="tabular-nums text-emerald-600">{r.discount_amount > 0 ? `-${money(r.discount_amount)}` : '—'}</span>,
      align: 'right',
    },
    {
      key: 'tax_amount',
      header: 'Tax',
      cell: (r) => (
        <span className="tabular-nums text-slate-600">
          {r.tax_amount > 0 ? `${money(r.tax_amount)} (${r.tax_rate}%)` : '—'}
        </span>
      ),
      align: 'right',
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => <span className="font-semibold tabular-nums text-slate-900">{money(r.total)}</span>,
      align: 'right',
    },
  ];

  const overviewItems = [
    { label: 'Invoice date', value: date(invoice.invoice_date) },
    { label: 'Due date', value: date(invoice.due_date) },
    { label: 'Payment terms', value: invoice.payment_term_name || 'Immediate' },
    {
      label: 'Billing period',
      value: invoice.period_start && invoice.period_end ? `${date(invoice.period_start)} – ${date(invoice.period_end)}` : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/portal/invoices', label: 'My invoices' }}
        title={
          <div className="flex items-center gap-3">
            <span>{invoice.number}</span>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        }
        description={`Issued on ${date(invoice.invoice_date)}`}
        actions={
          <ButtonLink href={`/print/invoices/${id}`}>
            Print invoice (A4)
          </ButtonLink>
        }
      />

      <Card>
        <CardHeader title="Invoice details" />
        <CardBody>
          <DescriptionList items={overviewItems} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Invoice lines" />
        <DataTable rows={lines} columns={lineColumns} empty="No line items." />
        <div className="border-t border-slate-200 bg-slate-50/50 p-5">
          <div className="max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-slate-800">{money(invoice.subtotal)}</span>
            </div>
            {invoice.discount_total > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount ({invoice.discount_name || 'Discount'})</span>
                <span className="tabular-nums font-medium">-{money(invoice.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Taxes</span>
              <span className="tabular-nums font-medium text-slate-800">{money(invoice.tax_total)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900 text-base">
              <span>Total amount</span>
              <span className="tabular-nums text-brand-600">{money(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600 pt-1">
              <span>Amount paid</span>
              <span className="tabular-nums text-slate-700">{money(invoice.amount_paid)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
              <span>Balance due</span>
              <span className="tabular-nums text-slate-900">{money(invoice.amount_due)}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
