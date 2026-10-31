import { AppShell } from '@/components/shell/app-shell';
import { requireUser } from '@/lib/session';

// Customer portal: customers only. Staff and admin are sent to /app.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(['customer'], '/portal');
  return (
    <AppShell user={user} area="portal">
      {children}
    </AppShell>
  );
}
