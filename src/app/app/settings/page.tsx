// S1 · CAT-5 · Taxes & Payment Terms settings page
import { requireUser } from '@/lib/session';
import SettingsClient from '@/components/s1/SettingsClient';

export default async function SettingsPage() {
  const user = await requireUser(['admin', 'staff'], '/app/settings');
  return <SettingsClient isAdmin={user.role === 'admin'} />;
}
