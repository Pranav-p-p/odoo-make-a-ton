// S3 · Billing and invoices (owner: S3). Starter schemas matching SPEC §3; S3 extends them.
import { z } from 'zod';
import { isoDate, optionalText, pageQuery, uuid } from './common';

export const runBillingSchema = z.object({ as_of: isoDate.optional() });
export const previewQuery = z.object({ as_of: isoDate.optional() });
export const bulkConfirmSchema = z.object({ ids: z.array(uuid).min(1).max(500) });
export const cancelInvoiceSchema = z.object({ reason: z.string().trim().min(1, 'is required').max(500) });
export const invoicesQuery = pageQuery.extend({
  status: z.enum(['draft', 'confirmed', 'paid', 'cancelled']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  customer_id: uuid.optional(),
  subscription_id: uuid.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export const sendInvoiceSchema = z.object({ note: optionalText }).default({});
