import { requireUser } from '@/lib/session';
import { TemplatesClient } from '@/components/s1/TemplatesClient';

export default async function TemplatesPage() {
  const user = await requireUser(['admin', 'staff'], '/app/templates');
  return <TemplatesClient isAdmin={user.role === 'admin'} />;
}
