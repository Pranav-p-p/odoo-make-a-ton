import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/errors';
import { Card, CardHeader, CardBody, PageHeader, Badge } from '@/components/ui';
import { DiscountRuleForm } from '@/components/s1/DiscountsClient';
import type { DiscountRule } from '@/lib/types';

export default async function DiscountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(['admin', 'staff'], `/app/discounts/${id}`);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('discount_rules')
    .select('*, product_ids:discount_rule_products(product_id)')
    .eq('id', id)
    .single();

  if (error || !data) throw errors.notFound('Discount rule');

  const rule: DiscountRule = {
    ...(data as object) as DiscountRule,
    // Flatten join rows to plain string[]
    product_ids: ((data as { product_ids: { product_id: string }[] }).product_ids ?? []).map((p) => p.product_id),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={rule.name}
        back={{ href: '/app/discounts', label: 'Discount rules' }}
        actions={!rule.is_active ? <Badge tone="gray">Archived</Badge> : undefined}
      />
      <Card>
        <CardHeader title="Rule details" />
        <CardBody>
          <DiscountRuleForm initial={rule} isAdmin={user.role === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}
