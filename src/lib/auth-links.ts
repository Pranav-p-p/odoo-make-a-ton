import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

/**
 * Email links are built by us (not by Supabase's mailer) so that:
 *  - signup confirmation proves email ownership before a login is linked to a customer record;
 *  - password reset happens on our server with the admin API, so the password rule is always checked.
 * Links carry a one-time `token_hash` that the server verifies.
 *
 * Without RESEND_API_KEY the email is skipped. In `next dev` the link is also returned so you
 * can click it during development; production builds never return it.
 */
export async function sendAuthLink(kind: 'signup' | 'recovery', email: string, password?: string, fullName?: string) {
  const admin = createAdminClient();
  const { data, error } =
    kind === 'signup'
      ? await admin.auth.admin.generateLink({ type: 'signup', email, password: password!, options: { data: { full_name: fullName } } })
      : await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (error || !data?.properties?.hashed_token) return { ok: false as const, error };

  const token = encodeURIComponent(data.properties.hashed_token);
  const link =
    kind === 'signup'
      ? `${env.appUrl}/auth/callback?token_hash=${token}&type=signup&next=/portal`
      : `${env.appUrl}/reset-password?token_hash=${token}`;

  const html =
    kind === 'signup'
      ? `<p>Welcome to Brightloop${fullName ? `, ${fullName}` : ''}!</p><p><a href="${link}">Confirm your email address</a> to finish creating your account.</p>`
      : `<p>Use this link to set a new password for your Brightloop account:</p><p><a href="${link}">Set a new password</a></p><p>If you didn't ask for this, ignore this email.</p>`;
  const subject = kind === 'signup' ? 'Confirm your Brightloop account' : 'Set your Brightloop password';
  const delivered = await sendEmail(email, subject, html);
  if (!delivered && process.env.NODE_ENV === 'development') console.info(`[auth] ${kind} link for ${email}: ${link}`);

  return {
    ok: true as const,
    user: data.user,
    delivered,
    devLink: !delivered && process.env.NODE_ENV === 'development' ? link : undefined,
  };
}
