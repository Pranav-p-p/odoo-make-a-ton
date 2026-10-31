import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { paymentTermSchema } from '@/lib/validation/s1';
import { pageQuery } from '@/lib/validation/common';
import type { z } from 'zod';

type PageQ = z.infer<typeof pageQuery>;

export const GET = route<undefined, PageQ>({ access: ['admin', 'staff'], query: pageQuery }, async ({ query, supabase }) => {
  const { page, page_size } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  const res = await supabase
    .from('payment_terms')
    .select('*', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (res.error) throw unwrap(res);
  return { data: res.data ?? [], page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: paymentTermSchema }, async ({ body, supabase }) => {
  const res = await supabase.from('payment_terms').insert(body).select().single();
  return created(unwrap(res, 'Payment term'));
});
