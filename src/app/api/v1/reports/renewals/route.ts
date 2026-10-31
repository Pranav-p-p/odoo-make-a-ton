import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { renewalsQuery } from '@/lib/validation/s4';

// S4 · Renewals widget: expiring soon + out of term (Should, D-9)
export const GET = route(
  { access: ['admin', 'staff'], query: renewalsQuery },
  async ({ query, supabase }) => {
    const data = unwrap(
      await supabase.rpc('report_renewals', {
        p_days: query.days,
      }),
    );
    return data;
  },
);

