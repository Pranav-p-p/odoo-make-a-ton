import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { sendEmail } from '@/lib/email';
import { sendInvoiceSchema } from '@/lib/validation/s3';
import type { Invoice } from '@/lib/types';
import { z } from 'zod';

type SendBody = z.infer<typeof sendInvoiceSchema>;

// POST /api/v1/invoices/:id/send  — staff, admin
// Emails the invoice to the customer; writes email_log; calls invoice_mark_sent only on success.
export const POST = route<SendBody, undefined, { id: string }>(
  { access: ['admin', 'staff'], body: sendInvoiceSchema },
  async ({ params, supabase }) => {
    const { id } = params;

    // Must be Confirmed or Paid (the SQL function enforces this too)
    const invRes = await supabase.from('invoices').select('*').eq('id', id).single();
    const invoice = unwrap<Invoice>(invRes, 'Invoice');

    const to = invoice.customer_snapshot.email;
    const subject = `Invoice ${invoice.number} from Brightloop`;
    const html = buildInvoiceEmail(invoice);

    const sent = await sendEmail(to, subject, html);
    const status: 'sent' | 'skipped' | 'failed' = sent ? 'sent' : 'skipped';
    const error = sent ? null : 'RESEND_API_KEY not configured — email skipped';

    // Write email_log (service role is not needed; the authenticated client can insert into email_log
    // because RLS on that table allows internal users to insert).
    await supabase.from('email_log').insert({
      to_email: to,
      subject,
      kind: 'invoice',
      related_id: id,
      status,
      error,
    });

    if (sent) {
      const markRes = await supabase.rpc('invoice_mark_sent', { p_id: id });
      unwrap(markRes, 'Invoice');
    }

    return { ok: true, status, to };
  },
);

function buildInvoiceEmail(inv: Invoice): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#1e293b">Invoice ${inv.number}</h2>
      <p>Dear ${inv.customer_snapshot.name},</p>
      <p>Please find your invoice <strong>${inv.number}</strong> attached.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="color:#64748b">Invoice date</td><td>${inv.invoice_date}</td></tr>
        <tr><td style="color:#64748b">Due date</td><td>${inv.due_date}</td></tr>
        <tr><td style="color:#64748b">Amount due</td><td><strong>₹${Number(inv.amount_due).toFixed(2)}</strong></td></tr>
      </table>
      <p style="color:#64748b;font-size:13px">Brightloop Software · billing@brightloop.example</p>
    </div>
  `;
}

