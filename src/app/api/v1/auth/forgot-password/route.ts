import { route } from '@/lib/api/handler';
import { sendAuthLink } from '@/lib/auth-links';
import { forgotPasswordSchema } from '@/lib/validation/auth';

// Always answers 200, so nobody can use this endpoint to find out which emails have accounts.
export const POST = route({ access: 'public', body: forgotPasswordSchema }, async ({ body }) => {
  const res = await sendAuthLink('recovery', body.email);
  return {
    ok: true,
    message: 'If an account exists for this email, a reset link is on its way.',
    ...(res.ok && res.devLink ? { dev_reset_link: res.devLink } : {}),
  };
});
