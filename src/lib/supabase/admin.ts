import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * SERVER ONLY. Service-role client: bypasses Row Level Security.
 * Use it only for the few things a user token cannot do: creating accounts
 * (signup, staff), setting a user's role in app_metadata, and banning users.
 * Never use it to read or write business data on behalf of a user.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('createAdminClient() must never run in the browser');
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
