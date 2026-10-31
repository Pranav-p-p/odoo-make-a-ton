import { requireUser } from '@/lib/session';

// Printable pages: no app chrome. Any signed-in user; RLS decides what they can see.
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireUser(undefined, '/print');
  return <div className="min-h-screen bg-white">{children}</div>;
}
