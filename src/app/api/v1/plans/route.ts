import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { activeFilter, planSchema } from '@/lib/validation/s1';
import { pageQuery } from '@/lib/validation/common';
import { z } from 'zod';

const plansQuery = pageQuery.extend({ active: activeFilter });
type PlansQ = z.infer<typeof plansQuery>;

export const GET = route<undefined, PlansQ>({ access: 'any', query: plansQuery }, async ({ query, supabase }) => {
  const { page, page_size, q, active } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('plans')
    .select('*', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (q) qb = qb.ilike('name', `%${q}%`);
  // Default: active only
  if (active === false) {
    qb = qb.eq('is_active', false);
  } else if (active === 'all') {
    // Show all
  } else {
    // Default or active === true: active only
    qb = qb.eq('is_active', true);
  }

  const res = await qb;
  if (res.error) throw unwrap(res);
  return { data: res.data ?? [], page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: planSchema }, async ({ body, supabase }) => {
  const res = await supabase.from('plans').insert(body).select().single();
  return created(unwrap(res, 'Plan'));
});

