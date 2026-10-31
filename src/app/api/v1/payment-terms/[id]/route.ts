import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { paymentTermSchema } from '@/lib/validation/s1';

export const GET = route({ access: ['admin', 'staff'] }, async ({ params, supabase }) => {
  const res = await supabase.from('payment_terms').select('*').eq('id', params.id).single();
  return unwrap<object>(res, 'Payment term');
});

export const PATCH = route({ access: ['admin'], body: paymentTermSchema.partial() }, async ({ body, params, supabase }) => {
  const res = await supabase.from('payment_terms').update(body).eq('id', params.id).select().single();
  return unwrap(res, 'Payment term');
});

