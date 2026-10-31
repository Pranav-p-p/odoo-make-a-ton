import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { pauseSchema } from '@/lib/validation/s2';
import type { Subscription } from '@/lib/types';
import type { z } from 'zod';

export const POST = route<z.infer<typeof pauseSchema>, undefined, { id: string }>(
  { access: ['admin', 'staff', 'customer'], body: pauseSchema },
  async ({ supabase, params, body }) => {
    const res = await supabase.rpc('sub_pause', {
      p_id: params.id,
      p_note: body?.note ?? null,
    });

    const subscription = unwrap<Subscription>(res, 'Subscription');
    return subscription;
  },
);
