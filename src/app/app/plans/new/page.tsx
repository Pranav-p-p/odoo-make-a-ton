import { requireUser } from '@/lib/session';
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui';
import { PlanForm } from '@/components/s1/PlansClient';

export default async function NewPlanPage() {
  const user = await requireUser(['admin'], '/app/plans/new');
  return (
    <div className="space-y-6">
      <PageHeader title="New plan" back={{ href: '/app/plans', label: 'Plans' }} />
      <Card>
        <CardHeader title="Plan details" />
        <CardBody>
          <PlanForm isAdmin={user.role === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}

