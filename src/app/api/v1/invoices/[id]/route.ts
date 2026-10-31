import { route } from '@/lib/api/handler';
import { unwrap, errors } from '@/lib/api/errors';
import type { Invoice, InvoiceLine } from '@/lib/types';

// GET /api/v1/invoices/:id  — admin/staff: any; customer: own non-Draft only
export const GET = route<undefined, undefined, { id: string }>(
  { access: 'any' },
  async ({ params, supabase, user }) => {
    const { id } = params;

    const invRes = await supabase.from('invoices').select('*').eq('id', id).single();
    const invoice = unwrap<Invoice>(invRes, 'Invoice');

    // Customers may not see Draft or another customer's invoice
    if (user.role === 'customer') {
      if (invoice.customer_id !== user.customer_id) throw errors.notFound('Invoice');
      if (invoice.status === 'draft') throw errors.notFound('Invoice');
    }

    const linesRes = await supabase
      .from('invoice_lines')
      .select('*')
      .eq('invoice_id', id)
      .order('sort_order');
    const lines = unwrap<InvoiceLine[]>(linesRes);

    return { ...invoice, lines };
  },
);

