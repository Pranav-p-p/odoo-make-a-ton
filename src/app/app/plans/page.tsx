import { requireUser } from '@/lib/session';
import { PlansClient } from '@/components/s1/PlansClient';

export default async function PlansPage() {
  const user = await requireUser(['admin', 'staff'], '/app/plans');
  return <PlansClient isAdmin={user.role === 'admin'} />;
}
