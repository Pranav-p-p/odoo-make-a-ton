import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { planSchema } from '@/lib/validation/s1';

// planSchema is a ZodEffects (has .refine). For PATCH we use the inner object and make it partial.
const planPatchSchema = planSchema.innerType().partial();

export const GET = route({ access: 'any' }, async ({ params, supabase }) => {
  const res = await supabase.from('plans').select('*').eq('id', params.id).single();
  return unwrap<object>(res, 'Plan');
});

export const PATCH = route({ access: ['admin'], body: planPatchSchema }, async ({ body, params, supabase }) => {
  const res = await supabase.from('plans').update(body).eq('id', params.id).select().single();
  return unwrap(res, 'Plan');
});

