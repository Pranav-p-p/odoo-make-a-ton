'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser Supabase client. Pages should normally use the API client in `@/lib/client/api`
 * instead; this exists for things like listening to auth state changes.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
