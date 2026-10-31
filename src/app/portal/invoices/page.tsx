'use client';

import {
  PageHeader,
  Card,
  DataTable,
  InvoiceStatusBadge,
  ButtonLink,
  type Column,
} from '@/components/ui';
import { useApi } from '@/lib/client/hooks';
import type { Customer, InvoiceListRow, SessionUser } from '@/lib/types';
import { date, money } from '@/lib/format';

interface CustomerResponse extends Customer {
  invoices: InvoiceListRow[];
}

export default function PortalInvoicesPage() {
  const { data: me } = useApi<SessionUser>('/me');
  const { data: customer, isLoading } = useApi<CustomerResponse>(
    me?.customer_id ? `/customers/${me.customer_id}` : null,
  );

  const invoices = customer?.invoices ?? [];

  const columns: Column<InvoiceListRow>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'invoice_date',
      header: 'Date',
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
      header: 'Balance',
      cell: (r) => <span className="tabular-nums text-slate-700">{money(r.amount_due)}</span>,
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <InvoiceStatusBadge status={r.status} overdue={r.is_overdue} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <ButtonLink href={`/portal/invoices/${r.id}`} variant="secondary" size="sm">
            View
          </ButtonLink>
          <ButtonLink href={`/print/invoices/${r.id}`} variant="ghost" size="sm">
            Print
          </ButtonLink>
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My invoices"
        description="Review billing statements, receipts and download printable invoices."
      />

      <Card>
        <DataTable
          rows={invoices}
          columns={columns}
          loading={isLoading}
          rowHref={(r) => `/portal/invoices/${r.id}`}
          empty="No invoices issued yet."
        />
      </Card>
    </div>
  );
}
