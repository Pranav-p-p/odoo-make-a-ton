import { requireUser } from '@/lib/session';
import { DiscountsClient } from '@/components/s1/DiscountsClient';

export default async function DiscountsPage() {
  const user = await requireUser(['admin', 'staff'], '/app/discounts');
  return <DiscountsClient isAdmin={user.role === 'admin'} />;
}
