import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { taxSchema } from '@/lib/validation/s1';

export const GET = route({ access: ['admin', 'staff'] }, async ({ params, supabase }) => {
  const res = await supabase.from('taxes').select('*').eq('id', params.id).single();
  return unwrap<object>(res, 'Tax');
});

export const PATCH = route({ access: ['admin'], body: taxSchema.partial() }, async ({ body, params, supabase }) => {
  const res = await supabase.from('taxes').update(body).eq('id', params.id).select().single();
  return unwrap(res, 'Tax');
});

