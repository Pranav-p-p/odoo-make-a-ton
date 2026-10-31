import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { Subscription } from '@/lib/types';

export const POST = route<undefined, undefined, { id: string }>({ access: ['admin', 'staff', 'customer'] }, async ({ supabase, params }) => {
  const res = await supabase.rpc('sub_resume', {
    p_id: params.id,
  });

  const subscription = unwrap<Subscription>(res, 'Subscription');
  return subscription;
});
