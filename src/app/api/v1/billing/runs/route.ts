import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { paged, rangeOf } from '@/lib/api/pagination';
import { pageQuery } from '@/lib/validation/common';
import type { BillingRun } from '@/lib/types';

// GET /api/v1/billing/runs  — staff, admin
// Query: page, page_size, sort
export const GET = route({ access: ['admin', 'staff'], query: pageQuery }, async ({ query, supabase }) => {
  const q = query!;
  const [from, to] = rangeOf(q);

  const res = await supabase
    .from('billing_runs')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(from, to);

  return paged<BillingRun>(unwrap(res), res.count, q);
});

