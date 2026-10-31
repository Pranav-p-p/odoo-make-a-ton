import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { errors } from '@/lib/api/errors';
import { Card, CardHeader, CardBody, PageHeader, Badge } from '@/components/ui';
import { TemplateForm } from '@/components/s1/TemplatesClient';
import type { QuoteTemplate } from '@/lib/types';

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(['admin', 'staff'], `/app/templates/${id}`);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('quote_templates')
    .select('*, lines:quote_template_lines(*, product:products(id,name,sales_price,variants:product_variants(*)))')
    .eq('id', id)
    .single();

  if (error || !data) throw errors.notFound('Template');

  const template = data as unknown as QuoteTemplate;
  return (
    <div className="space-y-6">
      <PageHeader
        title={template.name}
        back={{ href: '/app/templates', label: 'Templates' }}
        actions={!template.is_active ? <Badge tone="gray">Archived</Badge> : undefined}
      />
      <Card>
        <CardHeader title="Template details" />
        <CardBody>
          <TemplateForm initial={template} isAdmin={user.role === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}
