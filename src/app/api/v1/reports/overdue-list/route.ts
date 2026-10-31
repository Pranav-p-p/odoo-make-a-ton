import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { InvoiceListRow } from '@/lib/types';

// S4 · Top 10 overdue invoices for the dashboard (PAY-2, REP-1)
// Queries the invoice_list view directly, sorted by due_date (oldest first).
export const GET = route(
  { access: ['admin', 'staff'] },
  async ({ supabase }) => {
    const data = unwrap<InvoiceListRow[]>(
      await supabase
        .from('invoice_list')
        .select('*')
        .eq('status', 'confirmed')
        .eq('is_overdue', true)
        .order('due_date', { ascending: true })
        .limit(10),
    );
    return data;
  },
);

