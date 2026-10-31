'use client';

import { useState, useCallback } from 'react';
import { useApiList } from '@/lib/client/hooks';
import {
  PageHeader, SearchInput, FilterTabs, Badge, DataTable,
  type Column, ButtonLink, Pagination, EmptyState,
} from '@/components/ui';
import { money } from '@/lib/format';
import type { Product, ProductType } from '@/lib/types';

const TYPE_LABELS: Record<ProductType, string> = {
  service: 'Service', software: 'Software', addon: 'Add-on', other: 'Other',
};
const TYPE_TONES: Record<ProductType, 'blue' | 'indigo' | 'purple' | 'gray'> = {
  service: 'blue', software: 'indigo', addon: 'purple', other: 'gray',
};

type TypeFilter = 'all' | ProductType;

export default function ProductsClient({ isAdmin }: { isAdmin: boolean }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [showArchived, setShowArchived] = useState(false);

  const handleSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const { data, isLoading } = useApiList<Product>('/products', {
    page,
    page_size: 20,
    q: q || undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    active: showArchived ? 'all' : 'true',
  });

  const columns: Column<Product>[] = [
    {
      key: 'name', header: 'Name',
      cell: (r) => <span className="font-medium text-slate-900">{r.name}</span>,
    },
    {
      key: 'type', header: 'Type',
      cell: (r) => <Badge tone={TYPE_TONES[r.type]}>{TYPE_LABELS[r.type]}</Badge>,
    },
    {
      key: 'sales_price', header: 'Sales price', align: 'right',
      cell: (r) => money(r.sales_price),
    },
    {
      key: 'cost_price', header: 'Cost price', align: 'right',
      cell: (r) => <span className="text-slate-500">{money(r.cost_price)}</span>,
    },
    {
      key: 'variants', header: 'Variants', align: 'center',
      cell: (r) => r.variants?.length ? (
        <Badge tone="gray">{r.variants.length}</Badge>
      ) : <span className="text-slate-400">—</span>,
    },
    {
      key: 'status', header: 'Status',
      cell: (r) => <Badge tone={r.is_active ? 'green' : 'gray'}>{r.is_active ? 'Active' : 'Archived'}</Badge>,
    },
  ];

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'service', label: 'Service' },
    { value: 'software', label: 'Software' },
    { value: 'addon', label: 'Add-on' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Manage products and their variants."
        actions={
          isAdmin ? (
            <ButtonLink href="/app/products/new" variant="primary">+ New product</ButtonLink>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput onSearch={handleSearch} placeholder="Search by name…" />
        <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <FilterTabs<TypeFilter>
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setPage(1); }}
          options={typeOptions}
        />
        {data?.data?.length === 0 && !isLoading ? (
          <EmptyState
            title="No products found"
            description={q ? 'Try a different search term.' : 'Create your first product.'}
            action={isAdmin ? <ButtonLink href="/app/products/new" variant="secondary">New product</ButtonLink> : undefined}
          />
        ) : (
          <DataTable
            rows={data?.data}
            columns={columns}
            loading={isLoading}
            rowHref={(r) => `/app/products/${r.id}`}
            empty="No products match your filters."
          />
        )}
      </div>

      {data && data.total > data.page_size && (
        <div className="mt-4">
          <Pagination page={page} pageSize={data.page_size} total={data.total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

