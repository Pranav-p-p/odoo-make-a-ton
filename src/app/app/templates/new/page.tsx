import { requireUser } from '@/lib/session';
import { Card, CardHeader, CardBody, PageHeader } from '@/components/ui';
import { TemplateForm } from '@/components/s1/TemplatesClient';

export default async function NewTemplatePage() {
  await requireUser(['admin'], '/app/templates/new');
  return (
    <div className="space-y-6">
      <PageHeader title="New quotation template" back={{ href: '/app/templates', label: 'Templates' }} />
      <Card>
        <CardHeader title="Template details" />
        <CardBody>
          <TemplateForm isAdmin={true} />
        </CardBody>
      </Card>
    </div>
  );
}

