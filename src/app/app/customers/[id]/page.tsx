'use client';

import { use, useState } from 'react';
import { PageHeader, Card, CardHeader, CardBody, DescriptionList, DataTable, Button, ButtonLink, SubscriptionStatusBadge, InvoiceStatusBadge, type Column } from '@/components/ui';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { CustomerDialog } from '@/components/s2/customer-dialog';
import type { Customer, SubscriptionListRow, InvoiceListRow } from '@/lib/types';
import { date, money } from '@/lib/format';

interface CustomerDetailResponse extends Customer {
  subscriptions: SubscriptionListRow[];
  invoices: InvoiceListRow[];
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [editOpen, setEditOpen] = useState(false);
  const refresh = useRefresh();

  const { data: customer, isLoading, error } = useApi<CustomerDetailResponse>(`/customers/${id}`);

  if (isLoading && !customer) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <Card className="h-48 animate-pulse bg-slate-100">
          <div className="p-6" />
        </Card>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <h3 className="font-semibold">Customer not found</h3>
        <p className="mt-1 text-sm text-red-600">This customer does not exist or has been removed.</p>
        <div className="mt-4">
          <ButtonLink href="/app/customers" variant="secondary">
            Back to Customers
          </ButtonLink>
        </div>
      </div>
    );
  }

  const subColumns: Column<SubscriptionListRow>[] = [
    {
      key: 'number',
      header: 'Number',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (r) => (
        <div>
          <span className="font-medium text-slate-800">{r.plan_name}</span>
          <span className="ml-2 text-xs text-slate-500 capitalize">({r.billing_period})</span>
        </div>
      ),
    },
    {
      key: 'recurring_amount',
      header: 'Recurring',
      cell: (r) => <span className="font-medium tabular-nums">{money(r.recurring_amount)}</span>,
      align: 'right',
    },
    {
      key: 'mrr',
      header: 'MRR',
      cell: (r) => <span className="text-slate-600 tabular-nums">{money(r.mrr)}</span>,
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => (
        <SubscriptionStatusBadge
          status={r.status}
          pauseReason={r.pause_reason}
          quoteExpired={r.quote_expired}
        />
      ),
    },
    {
      key: 'start_date',
      header: 'Start date',
      cell: (r) => <span className="text-xs text-slate-500">{date(r.start_date)}</span>,
    },
    {
      key: 'next_invoice_date',
      header: 'Next invoice',
      cell: (r) => <span className="text-xs text-slate-500">{date(r.next_invoice_date)}</span>,
    },
  ];

  const invColumns: Column<InvoiceListRow>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'invoice_date',
      header: 'Invoice date',
      cell: (r) => <span className="text-xs text-slate-600">{date(r.invoice_date)}</span>,
    },
    {
      key: 'due_date',
      header: 'Due date',
      cell: (r) => <span className="text-xs text-slate-600">{date(r.due_date)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => <span className="font-medium tabular-nums">{money(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'amount_due',
      header: 'Amount due',
      cell: (r) => <span className="text-slate-700 tabular-nums">{money(r.amount_due)}</span>,
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <InvoiceStatusBadge status={r.status} overdue={r.is_overdue} />,
    },
  ];

  const details = [
    { label: 'Customer Name', value: customer.name },
    { label: 'Company', value: customer.company_name || '—' },
    { label: 'Email', value: <span className="font-mono text-xs">{customer.email}</span> },
    { label: 'Phone', value: customer.phone || '—' },
    { label: 'GSTIN', value: customer.gstin ? <span className="font-mono text-xs">{customer.gstin}</span> : '—' },
    { label: 'Customer Since', value: date(customer.created_at) },
    { label: 'Billing Address', value: customer.address || '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/app/customers', label: 'Customers' }}
        title={customer.name}
        description={customer.company_name ? `Company: ${customer.company_name}` : 'Customer profile'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Edit customer
            </Button>
            <ButtonLink href={`/app/subscriptions/new?customer_id=${customer.id}`}>
              New subscription
            </ButtonLink>
          </div>
        }
      />

      <Card>
        <CardHeader title="Customer details" />
        <CardBody>
          <DescriptionList items={details} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Subscriptions"
          description={`Active, draft and historical subscriptions (${customer.subscriptions?.length ?? 0})`}
          actions={
            <ButtonLink href={`/app/subscriptions/new?customer_id=${customer.id}`} size="sm">
              Add subscription
            </ButtonLink>
          }
        />
        <DataTable
          rows={customer.subscriptions}
          columns={subColumns}
          rowHref={(r) => `/app/subscriptions/${r.id}`}
          empty="No subscriptions yet."
        />
      </Card>

      <Card>
        <CardHeader
          title="Invoices"
          description={`Billing history and invoices (${customer.invoices?.length ?? 0})`}
        />
        <DataTable
          rows={customer.invoices}
          columns={invColumns}
          rowHref={(r) => `/app/invoices/${r.id}`}
          empty="No invoices generated yet."
        />
      </Card>

      <CustomerDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customer}
        onSuccess={() => refresh(`/customers/${id}`)}
      />
    </div>
  );
}
