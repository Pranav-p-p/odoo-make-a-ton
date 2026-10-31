'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from './cn';
import { Input } from './form';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Tabs used as a filter, e.g. invoice status. */
export function FilterTabs<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 px-4">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium',
            value === o.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Search box that reports its value 300 ms after typing stops. */
export function SearchInput({ onSearch, placeholder = 'Search…' }: { onSearch: (q: string) => void; placeholder?: string }) {
  const [v, setV] = useState('');
  useEffect(() => {
    const t = setTimeout(() => onSearch(v.trim()), 300);
    return () => clearTimeout(t);
  }, [v, onSearch]);
  return <Input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="max-w-xs" />;
}

/** Yellow box for the module TODOs in starter pages. Delete it when the screen is done. */
export function TodoNote({ owner, children }: { owner: string; children: ReactNode }) {
  return (
    <div className="no-print mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">To build ({owner})</p>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}
