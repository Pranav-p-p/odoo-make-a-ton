// S4 · Payments and finance (owner: S4). Starter schemas matching SPEC §3; S4 extends them.
import { z } from 'zod';
import { isoDate, optionalText, pageQuery, uuid } from './common';

export const paymentMethod = z.enum(['cash', 'bank_transfer', 'card', 'upi', 'cheque']);
export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('must be more than 0').transform((n) => Math.round(n * 100) / 100),
  method: paymentMethod,
  paid_on: isoDate.optional(),
  note: optionalText,
});
export const paymentsQuery = pageQuery.extend({ from: isoDate.optional(), to: isoDate.optional(), method: paymentMethod.optional(), customer_id: uuid.optional() });
export const reportQuery = z.object({ from: isoDate, to: isoDate, plan_id: uuid.optional(), customer_id: uuid.optional() });
export const revenueQuery = z.object({ from: isoDate, to: isoDate, bucket: z.enum(['day', 'week', 'month']).default('month') });
export const renewalsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
