import { requireUser } from '@/lib/session';
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui';
import { DiscountRuleForm } from '@/components/s1/DiscountsClient';

export default async function NewDiscountPage() {
  await requireUser(['admin'], '/app/discounts/new');
  return (
    <div className="space-y-6">
      <PageHeader title="New discount rule" back={{ href: '/app/discounts', label: 'Discount rules' }} />
      <Card>
        <CardHeader title="Rule details" />
        <CardBody>
          <DiscountRuleForm isAdmin={true} />
        </CardBody>
      </Card>
    </div>
  );
}

