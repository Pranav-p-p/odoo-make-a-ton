'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  DescriptionList,
  DataTable,
  Button,
  ButtonLink,
  Dialog,
  Textarea,
  Field,
  Badge,
  SubscriptionStatusBadge,
  InvoiceStatusBadge,
  type Column,
} from '@/components/ui';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { api, ApiClientError } from '@/lib/client/api';
import { LinesEditorDialog } from '@/components/s2/lines-editor-dialog';
import { SubscriptionHeaderDialog } from '@/components/s2/subscription-header-dialog';
import type { SubscriptionDetail } from '@/app/api/v1/subscriptions/[id]/route';
import type { SubscriptionLine, InvoiceListRow, Product, ProductVariant, PaymentTerm } from '@/lib/types';
import { date, dateTime, money } from '@/lib/format';

interface OptionsResponse {
  payment_terms: PaymentTerm[];
  products: (Product & { variants: ProductVariant[] })[];
}

export default function SubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const refresh = useRefresh();

  const { data, isLoading, error } = useApi<SubscriptionDetail>(`/subscriptions/${id}`);
  const { data: options } = useApi<OptionsResponse>('/subscriptions/options');

  // Modals
  const [headerOpen, setHeaderOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseNote, setPauseNote] = useState('');

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
        <Card className="h-96 animate-pulse bg-slate-100"><div className="p-6" /></Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-800">
        <h3 className="font-semibold">Subscription not found</h3>
        <p className="mt-1 text-sm text-red-600">This subscription does not exist or has been removed.</p>
        <div className="mt-4">
          <ButtonLink href="/app/subscriptions" variant="secondary">
            Back to Subscriptions
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { subscription, customer, plan, payment_term, lines, allowed_actions, history, invoices } = data;
  // sub_allowed_actions returns 'edit' in Draft/Quotation (header and lines) and 'edit_lines' in Active (D-13);
  // closing is 'closed' for a Draft/Quotation/Confirmed discard and 'close' for an Active subscription.
  const canEditLines = allowed_actions.includes('edit') || allowed_actions.includes('edit_lines');
  const canClose = allowed_actions.includes('close') || allowed_actions.includes('closed');

  const handleAction = async (fn: () => Promise<unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await fn();
      refresh(`/subscriptions/${id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.message);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError('Action failed');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAction(async () => {
      await api.post(`/subscriptions/${id}/close`, { reason: closeReason || null });
      setCloseOpen(false);
    });
  };

  const handlePause = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAction(async () => {
      await api.post(`/subscriptions/${id}/pause`, { note: pauseNote || null });
      setPauseOpen(false);
    });
  };

  // Line columns
  const lineColumns: Column<SubscriptionLine>[] = [
    {
      key: 'description',
      header: 'Item',
      cell: (r) => (
        <div>
          <span className="font-medium text-slate-800">{r.description}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (r) => <span className="tabular-nums">{r.quantity}</span>,
      align: 'right',
    },
    {
      key: 'unit_price',
      header: 'Unit price',
      cell: (r) => <span className="tabular-nums text-slate-600">{money(r.unit_price)}</span>,
      align: 'right',
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => <span className="font-medium tabular-nums text-slate-900">{money(r.quantity * r.unit_price)}</span>,
      align: 'right',
    },
  ];

  // Invoice columns
  const invColumns: Column<InvoiceListRow>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'invoice_date',
      header: 'Invoice date',
      cell: (r) => <span className="text-xs text-slate-600">{date(r.invoice_date)}</span>,
    },
    {
      key: 'due_date',
      header: 'Due date',
      cell: (r) => <span className="text-xs text-slate-600">{date(r.due_date)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      cell: (r) => <span className="font-medium tabular-nums">{money(r.total)}</span>,
      align: 'right',
    },
    {
      key: 'amount_due',
      header: 'Amount due',
      cell: (r) => <span className="text-slate-700 tabular-nums">{money(r.amount_due)}</span>,
      align: 'right',
    },
    {
      key: 'status',
      header: 'Status',
      cell: (r) => <InvoiceStatusBadge status={r.status} overdue={r.is_overdue} />,
    },
  ];

  const linesTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const planFee = plan.price;
  const recurringTotal = planFee + linesTotal;

  const overviewItems = [
    {
      label: 'Customer',
      value: (
        <Link href={`/app/customers/${customer.id}`} className="font-medium text-brand-600 hover:underline">
          {customer.name} {customer.company_name ? `(${customer.company_name})` : ''}
        </Link>
      ),
    },
    {
      label: 'Plan',
      value: (
        <span>
          {plan.name} <span className="text-xs text-slate-500 capitalize">({plan.billing_period})</span>
        </span>
      ),
    },
    { label: 'Start Date', value: date(subscription.start_date) },
    { label: 'Expiry Date', value: subscription.expiry_date ? date(subscription.expiry_date) : 'Open-ended' },
    { label: 'Payment Terms', value: payment_term ? `${payment_term.name} (${payment_term.days} days)` : 'Immediate' },
    {
      label: 'Next Invoice',
      value: subscription.next_invoice_date ? date(subscription.next_invoice_date) : '—',
    },
    {
      label: 'Quote Valid Until',
      value: subscription.quote_valid_until ? date(subscription.quote_valid_until) : '—',
    },
    {
      label: 'Billing Anchor',
      value: subscription.billing_anchor ? date(subscription.billing_anchor) : '—',
    },
    { label: 'Notes', value: subscription.notes || '—' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/app/subscriptions', label: 'Subscriptions' }}
        title={
          <div className="flex items-center gap-3">
            <span>{subscription.number}</span>
            <SubscriptionStatusBadge
              status={subscription.status}
              pauseReason={subscription.pause_reason}
              quoteExpired={
                subscription.status === 'quotation' &&
                !!subscription.quote_valid_until &&
                subscription.quote_valid_until < new Date().toISOString().slice(0, 10)
              }
            />
          </div>
        }
        description={`Created on ${date(subscription.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {allowed_actions.includes('edit') && (
              <Button variant="secondary" size="sm" onClick={() => setHeaderOpen(true)}>
                Edit header
              </Button>
            )}

            {canEditLines && (
              <Button variant="secondary" size="sm" onClick={() => setLinesOpen(true)}>
                Edit lines
              </Button>
            )}

            {allowed_actions.includes('quotation') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() =>
                  handleAction(() =>
                    api.post(`/subscriptions/${id}/transition`, { to: 'quotation', note: 'Sent as quotation' }),
                  )
                }
              >
                Send as quotation
              </Button>
            )}

            {allowed_actions.includes('confirmed') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() =>
                  handleAction(() =>
                    api.post(`/subscriptions/${id}/transition`, { to: 'confirmed', note: 'Quotation confirmed by customer' }),
                  )
                }
              >
                Confirm quotation
              </Button>
            )}

            {allowed_actions.includes('active') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() =>
                  handleAction(() =>
                    api.post(`/subscriptions/${id}/transition`, { to: 'active', note: 'Activated' }),
                  )
                }
              >
                Activate subscription
              </Button>
            )}

            {allowed_actions.includes('pause') && (
              <Button variant="secondary" size="sm" onClick={() => setPauseOpen(true)} disabled={actionLoading}>
                Pause
              </Button>
            )}

            {allowed_actions.includes('resume') && (
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleAction(() => api.post(`/subscriptions/${id}/resume`))}
              >
                Resume
              </Button>
            )}

            {allowed_actions.includes('renew') && (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() => handleAction(() => api.post(`/subscriptions/${id}/renew`))}
              >
                Renew (+1 period)
              </Button>
            )}

            {canClose && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setCloseOpen(true)}
                disabled={actionLoading}
              >
                {subscription.status === 'active' ? 'Close' : 'Discard'}
              </Button>
            )}
          </div>
        }
      />

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Action could not be completed</p>
          <p className="mt-0.5 text-xs text-red-600">{actionError}</p>
        </div>
      )}

      {/* Special status callouts */}
      {subscription.status === 'quotation' &&
        subscription.quote_valid_until &&
        subscription.quote_valid_until < new Date().toISOString().slice(0, 10) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <span className="font-semibold">Quotation Expired:</span> This quotation expired on {date(subscription.quote_valid_until)} and cannot be confirmed. Update dates or discard.
          </div>
        )}

      {subscription.status === 'active' && subscription.pause_reason === 'out_of_term' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <span className="font-semibold">Expired, Renewal Needed:</span> The subscription has reached its expiry date without auto-close. Billing is suspended until renewed.
        </div>
      )}

      {subscription.status === 'active' && subscription.pause_reason === 'manual' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Subscription Paused:</span> Paused on {date(subscription.paused_on)}. Billing will restart from the resume date.
        </div>
      )}

      {/* Overview Card */}
      <Card>
        <CardHeader
          title="Subscription overview"
          actions={
            allowed_actions.includes('edit') && (
              <Button variant="secondary" size="sm" onClick={() => setHeaderOpen(true)}>
                Edit header
              </Button>
            )
          }
        />
        <CardBody>
          <DescriptionList items={overviewItems} />
        </CardBody>
      </Card>

      {/* Product Lines Card */}
      <Card>
        <CardHeader
          title="Product lines &amp; pricing"
          description="Plan fees and product seats snapshotted for recurring invoicing."
          actions={
            canEditLines && (
              <Button variant="secondary" size="sm" onClick={() => setLinesOpen(true)}>
                Edit lines
              </Button>
            )
          }
        />
        <DataTable
          rows={lines}
          columns={lineColumns}
          empty="No product lines added."
        />
        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
          <div className="max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Plan fee ({plan.name})</span>
              <span className="tabular-nums font-medium text-slate-800">{money(planFee)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Product lines</span>
              <span className="tabular-nums font-medium text-slate-800">{money(linesTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900 text-base">
              <span>Recurring amount</span>
              <span className="tabular-nums text-brand-600">{money(recurringTotal)}</span>
            </div>
            <p className="text-[11px] text-slate-500 text-right">
              Per {plan.billing_period} (before discounts &amp; taxes)
            </p>
          </div>
        </div>
      </Card>

      {/* Invoices Generated Card */}
      <Card>
        <CardHeader
          title="Generated invoices"
          description={`Past and current invoices billed for this subscription (${invoices.length})`}
        />
        <DataTable
          rows={invoices}
          columns={invColumns}
          rowHref={(r) => `/app/invoices/${r.id}`}
          empty="No invoices generated yet. Invoices appear when billing runs."
        />
      </Card>

      {/* Status History Timeline Card */}
      <Card>
        <CardHeader
          title="Status history &amp; audit log"
          description="Full state machine transition timeline with actors and notes."
        />
        <CardBody className="p-0">
          <div className="divide-y divide-slate-100">
            {history.map((h) => (
              <div key={h.id} className="flex items-start gap-4 p-4 text-xs">
                <div className="mt-0.5">
                  <Badge tone={h.event === 'transition' ? 'blue' : h.event === 'pause' ? 'amber' : h.event === 'renew' ? 'indigo' : 'gray'}>
                    {h.event}
                  </Badge>
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {h.from_status ? `${h.from_status} → ` : ''}{h.to_status}
                    </span>
                    <span className="text-slate-400">{dateTime(h.changed_at)}</span>
                  </div>
                  {h.note && <p className="text-slate-600">{h.note}</p>}
                  <p className="text-[11px] text-slate-400">By {h.changer_name}</p>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="p-6 text-center text-slate-500 text-sm">
                No history recorded yet.
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Edit Header Dialog */}
      <SubscriptionHeaderDialog
        open={headerOpen}
        onClose={() => setHeaderOpen(false)}
        subscription={subscription}
        paymentTerms={options?.payment_terms || []}
        onSuccess={() => refresh(`/subscriptions/${id}`)}
      />

      {/* Edit Lines Dialog */}
      <LinesEditorDialog
        open={linesOpen}
        onClose={() => setLinesOpen(false)}
        subscriptionId={id}
        initialLines={lines}
        products={options?.products || []}
        onSuccess={() => refresh(`/subscriptions/${id}`)}
      />

      {/* Pause Dialog */}
      <Dialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause subscription"
        description="Pause recurring billing for this subscription. The billing period will re-anchor when resumed."
        footer={
          <>
            <Button variant="secondary" onClick={() => setPauseOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handlePause} disabled={actionLoading}>
              {actionLoading ? 'Pausing...' : 'Confirm pause'}
            </Button>
          </>
        }
      >
        <Field label="Pause reason / note">
          {(fieldId) => (
            <Textarea
              id={fieldId}
              value={pauseNote}
              onChange={(e) => setPauseNote(e.target.value)}
              placeholder="e.g. Customer requested temporary seasonal hold"
              rows={2}
            />
          )}
        </Field>
      </Dialog>

      {/* Close Dialog */}
      <Dialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title={subscription.status === 'active' ? 'Close subscription' : 'Discard subscription'}
        description="This action moves the subscription to Closed and halts all recurring billing."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClose} disabled={actionLoading}>
              {actionLoading ? 'Closing...' : subscription.status === 'active' ? 'Close subscription' : 'Discard subscription'}
            </Button>
          </>
        }
      >
        <Field label="Close reason">
          {(fieldId) => (
            <Textarea
              id={fieldId}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="e.g. Contract completed, cancelled by customer"
              rows={2}
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
