'use client';

import { useState } from 'react';
import {
  PageHeader,
  DataTable,
  Pagination,
  ButtonLink,
  SearchInput,
  FilterTabs,
  Card,
  SubscriptionStatusBadge,
  Select,
  type Column,
} from '@/components/ui';
import { useApiList } from '@/lib/client/hooks';
import type { SubscriptionListRow, SubscriptionStatus } from '@/lib/types';
import { date, money } from '@/lib/format';

type TabStatus = 'all' | SubscriptionStatus;

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<TabStatus>('all');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [flag, setFlag] = useState<string>('all');

  const { data, isLoading } = useApiList<SubscriptionListRow>('/subscriptions', {
    page,
    page_size: 20,
    status: tab === 'all' ? undefined : tab,
    flag: flag === 'all' ? undefined : (flag as 'paused' | 'out_of_term' | 'quote_expired'),
    q: query || undefined,
  });

  const columns: Column<SubscriptionListRow>[] = [
    {
      key: 'number',
      header: 'Subscription #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.customer_name}</div>
          {r.company_name && <div className="text-xs text-slate-500">{r.company_name}</div>}
        </div>
      ),
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
      key: 'next_invoice_date',
      header: 'Next invoice',
      cell: (r) => (
        <span className="text-xs text-slate-600">
          {r.status === 'active' && !r.is_paused ? date(r.next_invoice_date) : date(r.start_date)}
        </span>
      ),
    },
  ];

  const tabOptions: { value: TabStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'quotation', label: 'Quotation' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'active', label: 'Active' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Monitor subscription lifecycles, quotations, recurring revenue, and renewals."
        actions={
          <ButtonLink href="/app/subscriptions/new">
            New subscription
          </ButtonLink>
        }
      />

      <Card>
        <FilterTabs
          value={tab}
          onChange={(newTab) => {
            setTab(newTab);
            setPage(1);
          }}
          options={tabOptions}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4">
          <div className="w-full max-w-sm">
            <SearchInput
              onSearch={(val) => {
                setQuery(val);
                setPage(1);
              }}
              placeholder="Search by number, customer..."
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Flag:</span>
            <Select
              value={flag}
              onChange={(e) => {
                setFlag(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="all">All subscriptions</option>
              <option value="paused">Paused</option>
              <option value="out_of_term">Expired, renewal needed</option>
              <option value="quote_expired">Quote expired</option>
            </Select>
          </div>
        </div>

        <DataTable
          rows={data?.data}
          columns={columns}
          loading={isLoading}
          rowHref={(r) => `/app/subscriptions/${r.id}`}
          empty="No subscriptions found matching the filter."
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
