'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useApiList } from '@/lib/client/hooks';
import { money, date, PAYMENT_METHOD_LABEL, today } from '@/lib/format';
import type { PaymentMethod } from '@/lib/types';
import {
  PageHeader,
  DataTable,
  Pagination,
  Badge,
  SearchInput,
  Input,
  Select,
  Field,
  type Column,
} from '@/components/ui';

interface PaymentRow {
  id: string;
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  method: PaymentMethod;
  amount: number;
  paid_on: string;
  note: string | null;
  created_at: string;
}

const METHOD_BADGE_TONE: Record<PaymentMethod, 'green' | 'blue' | 'purple' | 'amber' | 'gray'> = {
  cash: 'green',
  bank_transfer: 'blue',
  card: 'purple',
  upi: 'amber',
  cheque: 'gray',
};

const columns: Column<PaymentRow>[] = [
  {
    key: 'paid_on',
    header: 'Date',
    cell: (r) => date(r.paid_on),
  },
  {
    key: 'invoice_number',
    header: 'Invoice',
    cell: (r) => (
      <Link
        href={`/app/invoices/${r.invoice_id}`}
        className="font-medium text-brand-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {r.invoice_number}
      </Link>
    ),
  },
  {
    key: 'customer_name',
    header: 'Customer',
    cell: (r) => r.customer_name,
  },
  {
    key: 'method',
    header: 'Method',
    cell: (r) => <Badge tone={METHOD_BADGE_TONE[r.method]}>{PAYMENT_METHOD_LABEL[r.method]}</Badge>,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    cell: (r) => <span className="font-medium tabular-nums">{money(r.amount)}</span>,
  },
  {
    key: 'note',
    header: 'Note',
    cell: (r) => <span className="max-w-xs truncate text-slate-500">{r.note || '—'}</span>,
  },
];

export default function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');

  const onSearch = useCallback((v: string) => { setQ(v); setPage(1); }, []);

  const list = useApiList<PaymentRow>('/payments', {
    page,
    page_size: 20,
    sort: '-paid_on',
    q: q || undefined,
    from: from || undefined,
    to: to || undefined,
    method: method || undefined,
  });

  return (
    <div>
      <PageHeader title="Payments" description="All recorded payments" />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchInput onSearch={onSearch} placeholder="Search invoice # or customer…" />
        <Field label="From">
          {(id) => <Input id={id} type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} max={to || today()} className="w-40" />}
        </Field>
        <Field label="To">
          {(id) => <Input id={id} type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} min={from} max={today()} className="w-40" />}
        </Field>
        <Field label="Method">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}>
              <option value="">All methods</option>
              {(['cash', 'bank_transfer', 'card', 'upi', 'cheque'] as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <DataTable rows={list.data?.data} columns={columns} loading={list.isLoading} empty="No payments found." />

      {list.data && list.data.total > list.data.page_size && (
        <div className="mt-4">
          <Pagination page={list.data.page} pageSize={list.data.page_size} total={list.data.total} onChange={setPage} />
        </div>
      )}
    </div>
  );
}
