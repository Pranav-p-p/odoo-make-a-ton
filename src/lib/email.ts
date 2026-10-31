import { env } from '@/lib/env';

/**
 * Sends an email through Resend's HTTP API. Returns false (and logs) when RESEND_API_KEY
 * is not set, so the app works in development without an email provider.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = env.resendApiKey;
  if (!key) {
    console.info(`[email] RESEND_API_KEY not set; skipped email to ${to}: ${subject}`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
  });
  if (!res.ok) {
    console.error('[email] Resend error', res.status, await res.text());
    return false;
  }
  return true;
}
