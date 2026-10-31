import type { ReactNode } from 'react';
import { INVOICE_STATUS_LABEL, SUBSCRIPTION_STATUS_LABEL } from '@/lib/format';
import type { InvoiceStatus, PauseReason, SubscriptionStatus } from '@/lib/types';
import { cn } from './cn';

type Tone = 'gray' | 'blue' | 'indigo' | 'green' | 'amber' | 'red' | 'purple';
const tones: Record<Tone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  indigo: 'bg-brand-50 text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-violet-50 text-violet-700 ring-violet-200',
};
const dots: Record<Tone, string> = {
  gray: 'bg-slate-400',
  blue: 'bg-sky-500',
  indigo: 'bg-brand-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-violet-500',
};

export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dots[tone])} />
      {children}
    </span>
  );
}

const SUB_TONE: Record<SubscriptionStatus, Tone> = {
  draft: 'gray',
  quotation: 'blue',
  confirmed: 'purple',
  active: 'green',
  closed: 'gray',
};
const INV_TONE: Record<InvoiceStatus, Tone> = { draft: 'gray', confirmed: 'blue', paid: 'green', cancelled: 'red' };

/** Status plus the pause flag (D-6, D-9): "Active · Paused" or "Expired, renewal needed". */
export function SubscriptionStatusBadge({
  status,
  pauseReason,
  quoteExpired,
}: {
  status: SubscriptionStatus;
  pauseReason?: PauseReason | null;
  quoteExpired?: boolean;
}) {
  if (status === 'active' && pauseReason === 'out_of_term') return <Badge tone="red">Expired, renewal needed</Badge>;
  if (status === 'active' && pauseReason === 'manual') return <Badge tone="amber">Paused</Badge>;
  if (status === 'quotation' && quoteExpired) return <Badge tone="amber">Quote expired</Badge>;
  return <Badge tone={SUB_TONE[status]}>{SUBSCRIPTION_STATUS_LABEL[status]}</Badge>;
}

/** Shows "Overdue" instead of "Confirmed" when the invoice is past due with a balance. */
export function InvoiceStatusBadge({ status, overdue }: { status: InvoiceStatus; overdue?: boolean }) {
  if (overdue) return <Badge tone="red">Overdue</Badge>;
  return <Badge tone={INV_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}
