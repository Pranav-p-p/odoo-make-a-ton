import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { closeSchema } from '@/lib/validation/s2';
import type { Subscription } from '@/lib/types';
import type { z } from 'zod';

export const POST = route<z.infer<typeof closeSchema>, undefined, { id: string }>(
  { access: ['admin', 'staff', 'customer'], body: closeSchema },
  async ({ supabase, params, body }) => {
    const res = await supabase.rpc('sub_close', {
      p_id: params.id,
      p_reason: body?.reason ?? null,
    });

    const subscription = unwrap<Subscription>(res, 'Subscription');
    return subscription;
  },
);
