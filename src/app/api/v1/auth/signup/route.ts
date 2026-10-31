import { route, created } from '@/lib/api/handler';
import { ApiError, errors } from '@/lib/api/errors';
import { sendAuthLink } from '@/lib/auth-links';
import { signupSchema } from '@/lib/validation/auth';

// Public sign-ups are OFF in Supabase, so every account comes through here and the password rule
// is always applied. The account stays unconfirmed (cannot sign in, not linked to any customer
// record) until the emailed link proves the person owns the address.
export const POST = route({ access: 'public', body: signupSchema }, async ({ body }) => {
  const res = await sendAuthLink('signup', body.email, body.password, body.full_name);
  if (!res.ok) {
    const e = res.error;
    if (e?.code === 'email_exists' || /already (been )?registered|already exists/i.test(e?.message ?? '')) {
      throw errors.conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    if (e?.code === 'weak_password') throw errors.validation({ password: [e.message] }, e.message);
    throw new ApiError(500, 'INTERNAL', e?.message ?? 'Could not create the account');
  }
  return created({
    status: 'confirmation_sent',
    email: body.email,
    email_delivered: res.delivered,
    ...(res.devLink ? { dev_confirm_link: res.devLink } : {}),
  });
});
