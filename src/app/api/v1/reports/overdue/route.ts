import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { OverdueBucket } from '@/lib/types';

// S4 · Overdue invoices by age bucket (PAY-2, D-25)
export const GET = route(
  { access: ['admin', 'staff'] },
  async ({ supabase }) => {
    const data = unwrap<OverdueBucket[]>(
      await supabase.rpc('report_overdue'),
    );
    return data;
  },
);

