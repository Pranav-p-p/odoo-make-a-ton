import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { activeFilter, paymentTermSchema } from '@/lib/validation/s1';
import { pageQuery } from '@/lib/validation/common';
import type { z } from 'zod';

const termsQuery = pageQuery.extend({ active: activeFilter });
type TermsQ = z.infer<typeof termsQuery>;

export const GET = route<undefined, TermsQ>({ access: ['admin', 'staff'], query: termsQuery }, async ({ query, supabase }) => {
  const { page, page_size, active } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('payment_terms')
    .select('*', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (active === false) {
    qb = qb.eq('is_active', false);
  } else if (active === 'all') {
    // Return all
  } else {
    // Default to active only
    qb = qb.eq('is_active', true);
  }

  const res = await qb;
  if (res.error) throw unwrap(res);
  return { data: res.data ?? [], page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: paymentTermSchema }, async ({ body, supabase }) => {
  const res = await supabase.from('payment_terms').insert(body).select().single();
  return created(unwrap(res, 'Payment term'));
});
