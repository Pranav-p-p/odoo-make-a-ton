import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { runBillingSchema } from '@/lib/validation/s3';
import type { BillingRun } from '@/lib/types';

// POST /api/v1/billing/run  — staff, admin
// Body: { as_of?: 'YYYY-MM-DD' }
// Returns: BillingRun
export const POST = route({ access: ['admin', 'staff'], body: runBillingSchema }, async ({ body, supabase }) => {
  const result = await supabase.rpc('run_billing', {
    p_as_of: body.as_of ?? null,
    p_trigger: 'manual',
  });
  return unwrap<BillingRun>(result, 'BillingRun');
});

