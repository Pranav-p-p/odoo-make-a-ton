import { requireUser } from '@/lib/session';
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui';
import { ProductForm } from '@/components/s1/ProductDetail';

export default async function NewProductPage() {
  const user = await requireUser(['admin'], '/app/products/new');
  return (
    <div className="space-y-6">
      <PageHeader title="New product" back={{ href: '/app/products', label: 'Products' }} />
      <Card>
        <CardHeader title="Product details" />
        <CardBody>
          <ProductForm isAdmin={user.role === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}

