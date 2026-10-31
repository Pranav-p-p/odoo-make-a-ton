import { AppShell } from '@/components/shell/app-shell';
import { requireUser } from '@/lib/session';

// Internal console: admin and staff only. Customers are sent to /portal.
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(['admin', 'staff'], '/app');
  return (
    <AppShell user={user} area="app">
      {children}
    </AppShell>
  );
}
