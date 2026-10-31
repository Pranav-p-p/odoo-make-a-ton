import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { previewQuery } from '@/lib/validation/s3';

// GET /api/v1/billing/preview?as_of=  — staff, admin (Should)
// Returns a dry-run summary without writing anything.
export const GET = route({ access: ['admin', 'staff'], query: previewQuery }, async ({ query, supabase }) => {
  const res = await supabase.rpc('preview_billing', { p_as_of: query!.as_of ?? null });
  return unwrap(res);
});

