import { route, created } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { recordPaymentSchema } from '@/lib/validation/s4';
import type { Payment } from '@/lib/types';

// S4 · Payments recorded against one invoice, oldest first (customers: own only, via RLS)
export const GET = route<undefined, undefined, { id: string }>({ access: 'any' }, async ({ params, supabase }) => {
  const res = await supabase.from('payments').select('*').eq('invoice_id', params.id).order('paid_on').order('created_at');
  return { data: unwrap<Payment[]>(res) };
});

// S4 · Record a payment against an invoice (PAY-1, D-24)
// Only staff and admin may record payments.
// The SQL function enforces: Confirmed only, amount > 0, amount ≤ balance, auto-Paid at zero balance.
export const POST = route(
  { access: ['admin', 'staff'], body: recordPaymentSchema },
  async ({ body, params, supabase }) => {
    const invoice = unwrap(
      await supabase.rpc('record_payment', {
        p_invoice_id: params.id,
        p_amount: body.amount,
        p_method: body.method,
        p_paid_on: body.paid_on ?? null,
        p_note: body.note ?? null,
      }),
      'Invoice',
    );
    return created(invoice);
  },
);

