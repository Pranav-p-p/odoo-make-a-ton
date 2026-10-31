import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/errors';
import { ProductDetailClient } from '@/components/s1/ProductDetail';
import type { Product } from '@/lib/types';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(['admin', 'staff'], `/app/products/${id}`);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('products')
    .select('*, variants:product_variants(*)')
    .eq('id', id)
    .single();

  if (error || !data) throw errors.notFound('Product');

  return <ProductDetailClient product={data as unknown as Product} isAdmin={user.role === 'admin'} />;
}
