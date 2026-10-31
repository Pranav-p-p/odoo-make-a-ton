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
    <div className="mb-7">
      {back && (
        <Link
          href={back.href}
          className="group mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-brand-700"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden>
            <path d="M12 15l-5-5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[30px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
          <path d="M3.5 7.5h13M5 4h10a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0115 16H5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 015 4z" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
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
            '-mb-px border-b-2 px-3 py-3 text-[13px] font-medium transition-colors',
            value === o.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-px text-[11px] tabular-nums',
                value === o.value ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500',
              )}
            >
              {o.count}
            </span>
          )}
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
  return (
    <div className="relative w-full max-w-xs">
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      >
        <circle cx="9" cy="9" r="5.5" />
        <path d="M13 13l3.5 3.5" strokeLinecap="round" />
      </svg>
      <Input type="search" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="pl-9" />
    </div>
  );
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
