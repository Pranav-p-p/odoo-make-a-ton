// Display helpers shared by every module. Safe in server and client code.
import type { BillingPeriod, InvoiceStatus, PaymentMethod, SubscriptionStatus } from '@/lib/types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });

/** ₹14,688.64 */
export const money = (n: number | string | null | undefined) => inr.format(Number(n ?? 0));
/** ₹38.1L — for KPI cards and chart axes */
export const moneyShort = (n: number | string | null | undefined) => inrShort.format(Number(n ?? 0));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-01-31' → '31 Jan 2026'. Parses the string itself so time zones never shift the day. */
export function date(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}
export function dateTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** Today as 'YYYY-MM-DD' in the browser's/server's local time. */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  draft: 'Draft',
  quotation: 'Quotation',
  confirmed: 'Confirmed',
  active: 'Active',
  closed: 'Closed',
};
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  upi: 'UPI',
  cheque: 'Cheque',
};
export const PERIOD_LABEL: Record<BillingPeriod, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };

/** 'every month' */
export const everyPeriod = (period: BillingPeriod) => `every ${PERIOD_LABEL[period]}`;
