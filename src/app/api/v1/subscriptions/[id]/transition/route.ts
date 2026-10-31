import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { transitionSchema } from '@/lib/validation/s2';
import type { Subscription } from '@/lib/types';
import type { z } from 'zod';

export const POST = route<z.infer<typeof transitionSchema>, undefined, { id: string }>(
  { access: ['admin', 'staff'], body: transitionSchema },
  async ({ supabase, params, body }) => {
    const res = await supabase.rpc('sub_transition', {
      p_id: params.id,
      p_to: body.to,
      p_note: body.note ?? null,
    });

    const subscription = unwrap<Subscription>(res, 'Subscription');
    return subscription;
  },
);
