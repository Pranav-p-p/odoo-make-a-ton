import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { setLinesSchema } from '@/lib/validation/s2';
import type { Subscription } from '@/lib/types';
import type { z } from 'zod';

export const PUT = route<z.infer<typeof setLinesSchema>, undefined, { id: string }>(
  { access: ['admin', 'staff'], body: setLinesSchema },
  async ({ supabase, params, body }) => {
    const res = await supabase.rpc('sub_set_lines', {
      p_id: params.id,
      p_lines: body.lines,
    });

    const subscription = unwrap<Subscription>(res, 'Subscription');
    return subscription;
  },
);
