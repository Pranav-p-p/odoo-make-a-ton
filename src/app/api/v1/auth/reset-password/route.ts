import { createClient as createPlainClient } from '@supabase/supabase-js';
import { route } from '@/lib/api/handler';
import { ApiError, errors } from '@/lib/api/errors';
import { loadSessionUser } from '@/lib/auth';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { resetPasswordSchema } from '@/lib/validation/auth';

/**
 * Sets a password on the server with the admin API, after the password rule has passed.
 *  - With token_hash (from the emailed link): verifies the one-time token, sets the password, signs in.
 *  - Without it: changes the password of the signed-in user.
 * The browser never holds a recovery session, so it cannot skip the rule by calling Supabase directly.
 */
export const POST = route({ access: 'public', body: resetPasswordSchema }, async ({ body, supabase }) => {
  const admin = createAdminClient();
  let userId: string;
  let email: string;

  if (body.token_hash) {
    const verifier = createPlainClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await verifier.auth.verifyOtp({ token_hash: body.token_hash, type: 'recovery' });
    if (error || !data.user?.email) throw new ApiError(400, 'LINK_EXPIRED', 'This link has expired or was already used. Ask for a new one.');
    userId = data.user.id;
    email = data.user.email;
    await verifier.auth.signOut().catch(() => undefined);
  } else {
    const me = await loadSessionUser(supabase);
    if (!me) throw errors.unauthenticated();
    userId = me.id;
    email = me.email;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
  if (error) throw errors.validation({ password: [error.message] }, error.message);

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: body.password });
  if (signInError) throw new ApiError(500, 'INTERNAL', signInError.message);
  const user = await loadSessionUser(supabase);
  return { ok: true, user };
});
