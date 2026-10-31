import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { revenueQuery } from '@/lib/validation/s4';
import type { RevenuePoint } from '@/lib/types';

// S4 · Revenue received vs invoiced per bucket (REP-1, D-25)
export const GET = route(
  { access: ['admin', 'staff'], query: revenueQuery },
  async ({ query, supabase }) => {
    const data = unwrap<RevenuePoint[]>(
      await supabase.rpc('report_revenue', {
        p_from: query.from,
        p_to: query.to,
        p_bucket: query.bucket,
      }),
    );
    return data;
  },
);

