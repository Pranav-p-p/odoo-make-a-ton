import { route } from '@/lib/api/handler';
import { unwrap, fromPostgres } from '@/lib/api/errors';
import { paymentsQuery } from '@/lib/validation/s4';
import { paged, rangeOf, sortOf, orIlike, type PageQuery } from '@/lib/api/pagination';

// S4 · List payments (PAY-1, PAY-2)
// Staff and admin see all payments; customers see only their own via RLS.
export const GET = route(
  { access: 'any', query: paymentsQuery },
  async ({ query, supabase, user }) => {
    const { page, page_size, sort, q, from, to, method, customer_id } = query;
    const [col, order] = sortOf(sort, ['paid_on', 'amount', 'created_at'], '-paid_on');
    const [rangeFrom, rangeTo] = rangeOf({ page, page_size } as PageQuery);

    let qb = supabase
      .from('payments')
      .select(
        '*, invoices(number), customers(name)',
        { count: 'exact' },
      )
      .order(col, order)
      .range(rangeFrom, rangeTo);

    // Customers only see their own payments (also enforced by RLS)
    if (user.role === 'customer') {
      if (!user.customer_id) return paged([], 0, { page, page_size });
      qb = qb.eq('customer_id', user.customer_id);
    }

    if (from) qb = qb.gte('paid_on', from);
    if (to) qb = qb.lte('paid_on', to);
    if (method) qb = qb.eq('method', method);
    if (customer_id) qb = qb.eq('customer_id', customer_id);
    if (q) {
      // PostgREST cannot OR across two embedded tables, so resolve the matching ids first.
      const [custs, invs] = await Promise.all([
        supabase.from('customers').select('id').or(orIlike(['name', 'company_name'], q)).limit(200),
        supabase.from('invoices').select('id').or(orIlike(['number'], q)).limit(200),
      ]);
      const custIds = (custs.data ?? []).map((r) => r.id);
      const invIds = (invs.data ?? []).map((r) => r.id);
      if (!custIds.length && !invIds.length) return paged([], 0, { page, page_size });
      const parts = [
        ...(custIds.length ? [`customer_id.in.(${custIds.join(',')})`] : []),
        ...(invIds.length ? [`invoice_id.in.(${invIds.join(',')})`] : []),
      ];
      qb = qb.or(parts.join(','));
    }

    const { data, count, error } = await qb;
    if (error) throw fromPostgres(error);

    // Flatten the joined shape into a flat row for the frontend
    const rows = (data ?? []).map((r: Record<string, unknown>) => {
      const inv = r.invoices as { number: string } | null;
      const cust = r.customers as { name: string } | null;
      return {
        ...r,
        invoice_number: inv?.number ?? null,
        customer_name: cust?.name ?? null,
        invoices: undefined,
        customers: undefined,
      };
    });

    return paged(rows, count, { page, page_size });
  },
);

