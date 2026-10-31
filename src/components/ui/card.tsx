import type { ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-card', className)}>{children}</div>;
}

export function CardHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

/** Label / value pairs for detail screens. */
export function DescriptionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{it.label}</dt>
          <dd className="mt-1 text-sm text-slate-900">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A KPI tile for dashboards. */
export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'bad' | 'good' }) {
  return (
    <Card className="relative px-5 py-4">
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          tone === 'bad' ? 'bg-red-500' : tone === 'good' ? 'bg-emerald-500' : 'bg-brand-500/70',
        )}
      />
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums',
          tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-600' : 'text-slate-900',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}
