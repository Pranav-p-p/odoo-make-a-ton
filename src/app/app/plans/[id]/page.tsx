import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/errors';
import { Card, CardHeader, CardBody, PageHeader, Badge } from '@/components/ui';
import { PlanForm } from '@/components/s1/PlansClient';
import type { Plan } from '@/lib/types';

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(['admin', 'staff'], `/app/plans/${id}`);
  const supabase = await createClient();

  const { data, error } = await supabase.from('plans').select('*').eq('id', id).single();
  if (error || !data) throw errors.notFound('Plan');

  const plan = data as unknown as Plan;
  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.name}
        back={{ href: '/app/plans', label: 'Plans' }}
        actions={!plan.is_active ? <Badge tone="gray">Archived</Badge> : undefined}
      />
      <Card>
        <CardHeader title="Plan details" />
        <CardBody>
          <PlanForm initial={plan} isAdmin={user.role === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}
