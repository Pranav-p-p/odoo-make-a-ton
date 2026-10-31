'use client';

import { Button } from './button';

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-[13px] text-slate-500">
      <span className="tabular-nums">
        <span className="font-medium text-slate-700">
          {from.toLocaleString('en-IN')}–{to.toLocaleString('en-IN')}
        </span>{' '}
        of {total.toLocaleString('en-IN')}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span className="px-1 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
