import { redirect } from 'next/navigation';
import { homeFor } from '@/lib/auth';
import { getUser } from '@/lib/session';

export default async function Home() {
  const user = await getUser();
  redirect(user ? homeFor(user.role) : '/login');
}
