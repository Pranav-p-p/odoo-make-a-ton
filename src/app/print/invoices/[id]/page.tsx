// Print page: /print/invoices/[id]
// Accessible to admin, staff, and the owning customer (never Draft).
// Opens the print dialog automatically on load.
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loadSessionUser } from '@/lib/auth';
import { money, date } from '@/lib/format';
import type { Invoice, InvoiceLine } from '@/lib/types';

async function getInvoice(id: string) {
  const supabase = await createClient();
  const user = await loadSessionUser(supabase);
  if (!user) redirect('/login');

  const { data: inv, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error || !inv) redirect('/app/invoices');

  // Customers may not print Draft or another customer's invoice
  if (user.role === 'customer') {
    if ((inv as Invoice).customer_id !== user.customer_id) redirect('/portal/invoices');
    if ((inv as Invoice).status === 'draft') redirect('/portal/invoices');
  }

  const { data: lines } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', id)
    .order('sort_order');

  return { inv: inv as Invoice, lines: (lines ?? []) as InvoiceLine[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('invoices').select('number').eq('id', id).maybeSingle();
  return { title: data?.number ? `Invoice ${data.number}` : 'Invoice' };
}

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { inv, lines } = await getInvoice(id);

  return (
    <div className="print-invoice">
        <style>{`
          @page { size: A4; margin: 20mm; }
          .print-invoice { max-width: 860px; margin: 0 auto; padding: 32px 24px; font-family: sans-serif; font-size: 13px; color: #1e293b; }
          h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
          .meta { color: #64748b; font-size: 12px; margin-bottom: 24px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
          .value { font-size: 13px; color: #1e293b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f8fafc; font-size: 11px; font-weight: 600; text-align: right; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
          th:first-child { text-align: left; }
          td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: top; }
          td:first-child { text-align: left; }
          .plan-row td { background: #f8fafc; }
          .totals { margin-left: auto; width: 260px; }
          .totals tr td { border: none; padding: 3px 0; }
          .totals .grand { font-weight: 700; font-size: 15px; border-top: 2px solid #e2e8f0; padding-top: 6px; }
          .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          @media print { button { display: none; } }
        `}</style>
        {/* Auto-print */}
        <script dangerouslySetInnerHTML={{ __html: 'window.onload=()=>window.print()' }} />

        <div style={{ marginBottom: 32 }}>
          <h1>Brightloop Software</h1>
          <p className="meta">Tax Invoice</p>
        </div>

        <div className="grid2">
          {/* Bill to */}
          <div>
            <p className="label">Bill to</p>
            <p className="value" style={{ fontWeight: 600 }}>{inv.customer_snapshot.name}</p>
            {inv.customer_snapshot.company_name && <p className="value">{inv.customer_snapshot.company_name}</p>}
            <p className="value">{inv.customer_snapshot.email}</p>
            {inv.customer_snapshot.address && <p className="value" style={{ color: '#64748b' }}>{inv.customer_snapshot.address}</p>}
            {inv.customer_snapshot.gstin && <p className="value" style={{ fontSize: 11, color: '#94a3b8' }}>GSTIN: {inv.customer_snapshot.gstin}</p>}
          </div>

          {/* Invoice info */}
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{inv.number}</p>
            <table style={{ marginLeft: 'auto', width: 'auto', marginBottom: 0 }}>
              <tbody>
                <tr><td className="label" style={{ textAlign: 'left', paddingRight: 16 }}>Invoice date</td><td>{date(inv.invoice_date)}</td></tr>
                <tr><td className="label" style={{ textAlign: 'left', paddingRight: 16 }}>Due date</td><td>{date(inv.due_date)}</td></tr>
                <tr><td className="label" style={{ textAlign: 'left', paddingRight: 16 }}>Period</td><td>{date(inv.period_start)} – {date(inv.period_end)}</td></tr>
                {inv.payment_term_name && <tr><td className="label" style={{ textAlign: 'left', paddingRight: 16 }}>Terms</td><td>{inv.payment_term_name}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lines */}
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Amount</th>
              <th>Discount</th>
              <th>Tax</th>
              <th>Tax amt</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className={l.kind === 'plan_fee' ? 'plan-row' : undefined}>
                <td>{l.kind === 'plan_fee' ? `[Plan] ${l.description}` : l.description}</td>
                <td>{l.quantity}</td>
                <td>{money(l.unit_price)}</td>
                <td>{money(l.amount)}</td>
                <td>{l.discount_amount > 0 ? `−${money(l.discount_amount)}` : '—'}</td>
                <td style={{ textAlign: 'left', fontSize: 11, color: '#64748b' }}>
                  {l.tax_name ? `${l.tax_name} (${l.tax_rate}%)` : '—'}
                </td>
                <td>{l.tax_amount > 0 ? money(l.tax_amount) : '—'}</td>
                <td style={{ fontWeight: 600 }}>{money(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <table className="totals">
          <tbody>
            <tr><td>Subtotal</td><td style={{ textAlign: 'right' }}>{money(inv.subtotal)}</td></tr>
            {inv.discount_total > 0 && (
              <tr><td>Discount{inv.discount_name ? ` (${inv.discount_name})` : ''}</td><td style={{ textAlign: 'right', color: '#059669' }}>−{money(inv.discount_total)}</td></tr>
            )}
            {inv.tax_total > 0 && (
              <tr><td>Tax</td><td style={{ textAlign: 'right' }}>{money(inv.tax_total)}</td></tr>
            )}
            <tr className="grand"><td>Total</td><td style={{ textAlign: 'right' }}>{money(inv.total)}</td></tr>
            {inv.amount_paid > 0 && (
              <tr><td style={{ color: '#64748b' }}>Paid</td><td style={{ textAlign: 'right', color: '#64748b' }}>{money(inv.amount_paid)}</td></tr>
            )}
            <tr>
              <td style={{ fontWeight: 700, color: inv.amount_due > 0 ? '#dc2626' : '#94a3b8' }}>Balance due</td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: inv.amount_due > 0 ? '#dc2626' : '#94a3b8' }}>{money(inv.amount_due)}</td>
            </tr>
          </tbody>
        </table>

        <p className="footer">
          Brightloop Software · Thank you for your business.
          This is a computer-generated invoice.
        </p>
    </div>
  );
}
