import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { reportQuery } from '@/lib/validation/s4';
import type { ReportSummary } from '@/lib/types';

// S4 · Dashboard KPIs (REP-1, REP-2, D-25)
export const GET = route(
  { access: ['admin', 'staff'], query: reportQuery },
  async ({ query, supabase }) => {
    const data = unwrap<ReportSummary>(
      await supabase.rpc('report_summary', {
        p_from: query.from,
        p_to: query.to,
        p_plan_id: query.plan_id ?? null,
        p_customer_id: query.customer_id ?? null,
      }),
    );
    return data;
  },
);

