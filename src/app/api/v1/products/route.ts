import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { productSchema, productsQuery } from '@/lib/validation/s1';
import type { z } from 'zod';

type ProductsQ = z.infer<typeof productsQuery>;

export const GET = route<undefined, ProductsQ>({ access: 'any', query: productsQuery }, async ({ query, supabase }) => {
  const { page, page_size, q, type, active } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('products')
    .select('*, variants:product_variants(*)', { count: 'exact' })
    .order('name')
    .range(from, to);

  // Search by name (trigram index)
  if (q) qb = qb.ilike('name', `%${q}%`);
  // Filter by type
  if (type) qb = qb.eq('type', type);
  // Active filter: default to active only (omit archived)
  if (active === false) {
    qb = qb.eq('is_active', false);
  } else if (active === 'all') {
    // Show all (both active and archived)
  } else {
    // Default or active === true: active only
    qb = qb.eq('is_active', true);
  }

  const res = await qb;
  if (res.error) throw unwrap(res);
  return { data: res.data ?? [], page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: productSchema }, async ({ body, supabase }) => {
  const { variants, ...productData } = body;

  // Insert the product
  const productRes = await supabase.from('products').insert(productData).select().single();
  const product = unwrap(productRes, 'Product');

  // Insert variants if provided
  if (variants && variants.length > 0) {
    const variantRows = variants.map((v) => ({ ...v, product_id: (product as { id: string }).id }));
    const varRes = await supabase.from('product_variants').insert(variantRows).select();
    if (varRes.error) throw unwrap(varRes);
  }

  // Return product with variants
  const fullRes = await supabase
    .from('products')
    .select('*, variants:product_variants(*)')
    .eq('id', (product as { id: string }).id)
    .single();
  return created(unwrap(fullRes, 'Product'));
});

