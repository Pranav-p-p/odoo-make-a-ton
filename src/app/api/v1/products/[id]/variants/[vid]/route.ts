import { route } from '@/lib/api/handler';
import { errors, unwrap } from '@/lib/api/errors';
import { variantSchema } from '@/lib/validation/s1';

export const PATCH = route({ access: ['admin'], body: variantSchema.partial() }, async ({ body, params, supabase }) => {
  const res = await supabase
    .from('product_variants')
    .update(body)
    .eq('id', params.vid)
    .eq('product_id', params.id)
    .select()
    .single();
  return unwrap(res, 'Variant');
});

export const DELETE = route({ access: ['admin'] }, async ({ params, supabase }) => {
  // Check for references in subscription_lines
  const { count } = await supabase
    .from('subscription_lines')
    .select('id', { count: 'exact', head: true })
    .eq('variant_id', params.vid);

  if (count && count > 0) throw errors.conflict('IN_USE', 'This variant is used in existing subscriptions');

  const res = await supabase
    .from('product_variants')
    .delete()
    .eq('id', params.vid)
    .eq('product_id', params.id)
    .select()
    .single();
  unwrap(res, 'Variant');
  return { ok: true };
});

