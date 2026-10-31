import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { Invoice } from '@/lib/types';

// POST /api/v1/invoices/:id/confirm  — staff, admin  (Draft → Confirmed)
export const POST = route<undefined, undefined, { id: string }>(
  { access: ['admin', 'staff'] },
  async ({ params, supabase }) => {
    const res = await supabase.rpc('invoice_confirm', { p_id: params.id });
    return unwrap<Invoice>(res, 'Invoice');
  },
);

