'use client';

import { useState } from 'react';
import {
  PageHeader,
  Card,
  DataTable,
  Pagination,
  SubscriptionStatusBadge,
  ButtonLink,
  type Column,
} from '@/components/ui';
import { useApiList } from '@/lib/client/hooks';
import type { SubscriptionListRow } from '@/lib/types';
import { date, money } from '@/lib/format';

export default function PortalSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApiList<SubscriptionListRow>('/subscriptions', {
    page,
    page_size: 20,
  });

  const columns: Column<SubscriptionListRow>[] = [
    {
      key: 'number',
      header: 'Subscription #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (r) => (
        <div>
          <span className="font-medium text-slate-800">{r.plan_name}</span>
          <span className="ml-1.5 text-xs text-slate-500 capitalize">({r.billing_period})</span>
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
      header: 'Started on',
      cell: (r) => <span className="text-xs text-slate-600">{date(r.start_date)}</span>,
    },
    {
      key: 'next_invoice_date',
      header: 'Next renewal',
      cell: (r) => (
        <span className="text-xs text-slate-600">
          {r.status === 'active' && !r.is_paused && r.next_invoice_date ? date(r.next_invoice_date) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <ButtonLink href={`/portal/subscriptions/${r.id}`} variant="secondary" size="sm">
          Manage
        </ButtonLink>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My subscriptions"
        description="View your active Brightloop services, billing cycles and manage renewals."
      />

      <Card>
        <DataTable
          rows={data?.data}
          columns={columns}
          loading={isLoading}
          rowHref={(r) => `/portal/subscriptions/${r.id}`}
          empty="You do not have any active subscriptions."
        />

        {data && data.total > 0 && (
          <Pagination
            page={data.page}
            pageSize={data.page_size}
            total={data.total}
            onChange={(p) => setPage(p)}
          />
        )}
      </Card>
    </div>
  );
}
