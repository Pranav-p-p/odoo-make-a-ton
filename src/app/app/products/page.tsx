import { requireUser } from '@/lib/session';
import ProductsClient from '@/components/s1/ProductsClient';

export default async function ProductsPage() {
  const user = await requireUser(['admin', 'staff'], '/app/products');
  return <ProductsClient isAdmin={user.role === 'admin'} />;
}
