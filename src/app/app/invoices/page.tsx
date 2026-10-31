'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client/api';
import { useApiList, useRefresh } from '@/lib/client/hooks';
import { money, date } from '@/lib/format';
import type { InvoiceListRow, InvoiceStatus } from '@/lib/types';
import {
  PageHeader, Card, Button, FilterTabs, SearchInput, Pagination,
  DataTable, type Column, InvoiceStatusBadge,
} from '@/components/ui';

type Tab = InvoiceStatus | 'overdue' | 'all';

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

function buildQuery(tab: Tab, q: string, page: number) {
  return {
    page,
    page_size: 20,
    ...(tab === 'all' ? {} : tab === 'overdue' ? { overdue: 'true' } : { status: tab }),
    ...(q ? { q } : {}),
  };
}

const COLS: Column<InvoiceListRow>[] = [
  {
    key: 'number',
    header: 'Invoice',
    cell: (r) => (
      <span className="font-mono text-xs font-medium text-brand-700">{r.number}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => <InvoiceStatusBadge status={r.status} overdue={r.is_overdue} />,
  },
  {
    key: 'customer_name',
    header: 'Customer',
    cell: (r) => (
      <div>
        <p className="font-medium text-slate-800">{r.customer_name}</p>
        <p className="text-xs text-slate-500 font-mono">{r.subscription_number}</p>
      </div>
    ),
  },
  {
    key: 'invoice_date',
    header: 'Invoice date',
    cell: (r) => date(r.invoice_date),
  },
  {
    key: 'due_date',
    header: 'Due',
    cell: (r) => (
      <span className={r.is_overdue ? 'text-red-600 font-medium' : undefined}>
        {date(r.due_date)}
      </span>
    ),
  },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    cell: (r) => money(r.total),
  },
  {
    key: 'amount_due',
    header: 'Balance',
    align: 'right',
    cell: (r) => (
      <span className={r.amount_due > 0 ? 'text-red-600' : 'text-slate-400'}>
        {money(r.amount_due)}
      </span>
    ),
  },
];

export default function InvoicesPage() {
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [confirmResult, setConfirmResult] = useState<{ confirmed: number; skipped: unknown[] } | null>(null);
  const refresh = useRefresh();

  const query = buildQuery(tab, q, page);
  const { data, isLoading, error } = useApiList<InvoiceListRow>('/invoices', query);

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setPage(1);
    setSelected(new Set());
    setConfirmResult(null);
  };

  const handleSearch = useCallback(
    (v: string) => {
      setQ(v);
      setPage(1);
    },
    [],
  );

  const bulkConfirm = async () => {
    if (!selected.size) return;
    setConfirming(true);
    setConfirmResult(null);
    try {
      const result = await api.post<{ confirmed: number; skipped: unknown[] }>('/invoices', {
        ids: [...selected],
      });
      setConfirmResult(result);
      setSelected(new Set());
      refresh('/invoices');
    } catch {
      // error toast could go here
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <PageHeader title="Invoices" description="All invoices across subscriptions." />

      {/* Bulk confirm result */}
      {confirmResult && (
        <div className="mb-4 rounded bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Confirmed {confirmResult.confirmed} invoice{confirmResult.confirmed !== 1 ? 's' : ''}.
          {confirmResult.skipped.length > 0 && ` ${confirmResult.skipped.length} skipped (not Draft).`}
        </div>
      )}

      <Card>
        {/* Status tabs */}
        <FilterTabs<Tab> value={tab} onChange={handleTabChange} options={TABS} />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <SearchInput onSearch={handleSearch} placeholder="Search by number, customer…" />
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button size="sm" onClick={bulkConfirm} loading={confirming}>
                Confirm {selected.size} invoice{selected.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <p className="px-4 py-3 text-sm text-red-700">Failed to load invoices: {error.message}</p>
        )}

        <DataTable<InvoiceListRow>
          rows={data?.data}
          columns={COLS}
          loading={isLoading}
          empty="No invoices match the current filter."
          rowHref={(r) => `/app/invoices/${r.id}`}
          selectable={tab === 'draft'}
          selected={selected}
          onSelectedChange={setSelected}
        />

        {data && data.total > data.page_size && (
          <div className="border-t border-slate-100 px-4 py-3">
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
