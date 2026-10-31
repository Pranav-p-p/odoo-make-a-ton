import { route } from '@/lib/api/handler';
import { ApiError, errors } from '@/lib/api/errors';
import { loadSessionUser } from '@/lib/auth';
import { loginSchema } from '@/lib/validation/auth';

export const POST = route({ access: 'public', body: loginSchema }, async ({ body, supabase }) => {
  const { data, error } = await supabase.auth.signInWithPassword(body);
  if (error?.code === 'email_not_confirmed') {
    throw new ApiError(403, 'EMAIL_NOT_CONFIRMED', 'Confirm your email first: use the link we sent you');
  }
  if (error || !data.session) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');

  const user = await loadSessionUser(supabase, data.session.access_token);
  if (!user) {
    await supabase.auth.signOut();
    throw errors.forbidden('This account has been deactivated');
  }
  // Tokens are returned for API tools (Postman, scripts); the browser uses the cookie.
  return { user, session: { access_token: data.session.access_token, expires_at: data.session.expires_at } };
});
