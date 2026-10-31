'use client';

import { useState } from 'react';
import { PageHeader, DataTable, Pagination, Button, SearchInput, Card, type Column } from '@/components/ui';
import { useApiList, useRefresh } from '@/lib/client/hooks';
import { CustomerDialog } from '@/components/s2/customer-dialog';
import type { Customer } from '@/lib/types';
import { date } from '@/lib/format';

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const refresh = useRefresh();

  const { data, isLoading } = useApiList<Customer>('/customers', {
    page,
    page_size: 20,
    q: query || undefined,
  });

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer',
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.name}</div>
          {r.company_name && <div className="text-xs text-slate-500">{r.company_name}</div>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      cell: (r) => <span className="font-mono text-xs text-slate-700">{r.email}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      cell: (r) => <span className="text-xs text-slate-600">{r.phone || '—'}</span>,
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      cell: (r) => (
        <span className="font-mono text-xs text-slate-600">{r.gstin || '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Added on',
      cell: (r) => <span className="text-xs text-slate-500">{date(r.created_at)}</span>,
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage your subscription customers, view history and track invoices."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            Add customer
          </Button>
        }
      />

      <Card>
        <div className="border-b border-slate-200 p-4">
          <div className="w-full max-w-sm">
            <SearchInput
              onSearch={(val) => {
                setQuery(val);
                setPage(1);
              }}
              placeholder="Search by name, company or email..."
            />
          </div>
        </div>

        <DataTable
          rows={data?.data}
          columns={columns}
          loading={isLoading}
          rowHref={(r) => `/app/customers/${r.id}`}
          empty="No customers found."
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

      <CustomerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => refresh('/customers')}
      />
    </div>
  );
}
