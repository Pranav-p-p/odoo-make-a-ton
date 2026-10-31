import type { SupabaseClient } from '@supabase/supabase-js';
import type { Role, SessionUser } from '@/lib/types';

/**
 * Loads the signed-in user with their role (from `profiles`) and, for customers,
 * their customer record id. Returns null when signed out or deactivated.
 */
export async function loadSessionUser(supabase: SupabaseClient, accessToken?: string): Promise<SessionUser | null> {
  const {
    data: { user },
    error,
  } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !profile.is_active) return null;

  let customerId: string | null = null;
  if (profile.role === 'customer') {
    const { data: c } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle();
    customerId = c?.id ?? null;
  }
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role as Role,
    customer_id: customerId,
  };
}

export const isInternal = (role: Role | undefined | null) => role === 'admin' || role === 'staff';
export const homeFor = (role: Role) => (role === 'customer' ? '/portal' : '/app');
