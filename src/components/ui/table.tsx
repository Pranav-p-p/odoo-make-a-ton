'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

/**
 * Simple data table.
 *   <DataTable rows={data?.data} columns={cols} loading={isLoading} rowHref={(r) => `/app/invoices/${r.id}`} />
 */
export function DataTable<T extends { id: string | number }>({
  rows,
  columns,
  loading,
  empty = 'Nothing here yet.',
  rowHref,
  selectable,
  selected,
  onSelectedChange,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  loading?: boolean;
  empty?: ReactNode;
  rowHref?: (row: T) => string;
  selectable?: boolean;
  selected?: Set<T['id']>;
  onSelectedChange?: (next: Set<T['id']>) => void;
}) {
  const router = useRouter();
  const list = rows ?? [];
  const allSelected = selectable && list.length > 0 && list.every((r) => selected?.has(r.id));
  const toggle = (id: T['id']) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  };
  const toggleAll = () => onSelectedChange?.(allSelected ? new Set() : new Set(list.map((r) => r.id)));
  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {selectable && (
              <th className="w-10 px-4 py-2.5">
                <input type="checkbox" aria-label="Select all" checked={!!allSelected} onChange={toggleAll} />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-2.5 font-medium text-slate-600', align(c.align), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading && !rows ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-3">
                  <div className="h-4 animate-pulse rounded bg-slate-100" />
                </td>
              </tr>
            ))
          ) : list.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-10 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          ) : (
            list.map((row) => (
              <tr
                key={row.id}
                onClick={rowHref ? () => router.push(rowHref(row)) : undefined}
                className={cn(rowHref && 'cursor-pointer hover:bg-slate-50')}
              >
                {selectable && (
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label="Select row" checked={!!selected?.has(row.id)} onChange={() => toggle(row.id)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-2.5 text-slate-800', align(c.align), c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
