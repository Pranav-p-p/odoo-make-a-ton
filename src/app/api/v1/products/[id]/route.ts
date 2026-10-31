import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { productSchema } from '@/lib/validation/s1';

export const GET = route({ access: 'any' }, async ({ params, supabase }) => {
  const res = await supabase
    .from('products')
    .select('*, variants:product_variants(*)')
    .eq('id', params.id)
    .single();
  return unwrap<object>(res, 'Product');
});

export const PATCH = route({ access: ['admin'], body: productSchema.partial() }, async ({ body, params, supabase }) => {
  // Separate variants from product fields
  const { variants: _, ...productData } = body;
  const res = await supabase.from('products').update(productData).eq('id', params.id).select().single();
  return unwrap(res, 'Product');
});

