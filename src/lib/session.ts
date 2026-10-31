import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { homeFor, loadSessionUser } from '@/lib/auth';
import type { Role, SessionUser } from '@/lib/types';

/** For server components and layouts: the signed-in user, or a redirect to /login. */
export async function requireUser(roles?: Role[], next = '/'): Promise<SessionUser> {
  const supabase = await createClient();
  const user = await loadSessionUser(supabase);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  return loadSessionUser(supabase);
}
