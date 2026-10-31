import { route } from '@/lib/api/handler';

export const POST = route({ access: 'public' }, async ({ supabase }) => {
  await supabase.auth.signOut();
  return { ok: true };
});
