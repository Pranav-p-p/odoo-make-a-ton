import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { variantSchema } from '@/lib/validation/s1';

export const POST = route({ access: ['admin'], body: variantSchema }, async ({ body, params, supabase }) => {
  const res = await supabase
    .from('product_variants')
    .insert({ ...body, product_id: params.id })
    .select()
    .single();
  return created(unwrap(res, 'Variant'));
});

