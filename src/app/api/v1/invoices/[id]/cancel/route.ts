import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { cancelInvoiceSchema } from '@/lib/validation/s3';
import type { Invoice } from '@/lib/types';
import { z } from 'zod';

type CancelBody = z.infer<typeof cancelInvoiceSchema>;

// POST /api/v1/invoices/:id/cancel  — staff, admin (Draft or Confirmed with no payments)
export const POST = route<CancelBody, undefined, { id: string }>(
  { access: ['admin', 'staff'], body: cancelInvoiceSchema },
  async ({ params, body, supabase }) => {
    const res = await supabase.rpc('invoice_cancel', { p_id: params.id, p_reason: body.reason });
    return unwrap<Invoice>(res, 'Invoice');
  },
);

