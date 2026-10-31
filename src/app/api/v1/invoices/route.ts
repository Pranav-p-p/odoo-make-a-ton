import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { paged, rangeOf, ilikeTerm, orIlike } from '@/lib/api/pagination';
import { invoicesQuery, bulkConfirmSchema } from '@/lib/validation/s3';
import type { InvoiceListRow } from '@/lib/types';

// GET /api/v1/invoices  — admin/staff: all; customer: own non-Draft only
export const GET = route({ access: 'any', query: invoicesQuery }, async ({ query, supabase, user }) => {
  const q = query!;
  const [from, to] = rangeOf(q);

  let builder = supabase
    .from('invoice_list')
    .select('*', { count: 'exact' })
    .range(from, to);

  // Customers see only their own invoices, never Draft
  if (user.role === 'customer') {
    builder = builder.eq('customer_id', user.customer_id!).neq('status', 'draft');
  }

  if (q.status) builder = builder.eq('status', q.status);
  // Overdue: is_overdue derived column in the view
  if (q.overdue === 'true') builder = builder.eq('is_overdue', true);
  if (q.customer_id) builder = builder.eq('customer_id', q.customer_id);
  if (q.subscription_id) builder = builder.eq('subscription_id', q.subscription_id);
  if (q.from) builder = builder.gte('invoice_date', q.from);
  if (q.to) builder = builder.lte('invoice_date', q.to);
  if (q.q) builder = builder.or(orIlike(['number', 'customer_name', 'subscription_number'], q.q));

  // Sort
  const sortCol = (q.sort ?? '').replace(/^-/, '') || 'invoice_date';
  const asc = !(q.sort ?? '').startsWith('-');
  builder = builder.order(sortCol, { ascending: asc });

  const res = await builder;
  return paged<InvoiceListRow>(unwrap(res), res.count, q);
});

// POST /api/v1/invoices/confirm  — bulk confirm
export const POST = route({ access: ['admin', 'staff'], body: bulkConfirmSchema }, async ({ body, supabase }) => {
  const res = await supabase.rpc('invoice_confirm_many', { p_ids: body.ids });
  return unwrap(res);
});

