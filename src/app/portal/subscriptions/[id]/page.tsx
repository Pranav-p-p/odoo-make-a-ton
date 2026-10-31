'use client';

import { use, useState } from 'react';
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
  SubscriptionStatusBadge,
  InvoiceStatusBadge,
  type Column,
} from '@/components/ui';
import { useApi, useRefresh } from '@/lib/client/hooks';
import { api, ApiClientError } from '@/lib/client/api';
import type { SubscriptionDetail } from '@/app/api/v1/subscriptions/[id]/route';
import type { SubscriptionLine, InvoiceListRow } from '@/lib/types';
import { date, money } from '@/lib/format';

export default function PortalSubscriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const refresh = useRefresh();

  const { data, isLoading, error } = useApi<SubscriptionDetail>(`/subscriptions/${id}`);

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
        <p className="mt-1 text-sm text-red-600">This subscription does not exist or you do not have permission to view it.</p>
        <div className="mt-4">
          <ButtonLink href="/portal" variant="secondary">
            Back to my subscriptions
          </ButtonLink>
        </div>
      </div>
    );
  }

  const { subscription, plan, lines, allowed_actions, invoices } = data;

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

  const lineColumns: Column<SubscriptionLine>[] = [
    {
      key: 'description',
      header: 'Item',
      cell: (r) => <span className="font-medium text-slate-800">{r.description}</span>,
    },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (r) => <span className="tabular-nums">{r.quantity}</span>,
      align: 'right',
    },
    {
      key: 'unit_price',
      header: 'Price',
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

  const invColumns: Column<InvoiceListRow>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      cell: (r) => <span className="font-mono font-medium text-brand-600">{r.number}</span>,
    },
    {
      key: 'invoice_date',
      header: 'Date',
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
      key: 'status',
      header: 'Status',
      cell: (r) => <InvoiceStatusBadge status={r.status} overdue={r.is_overdue} />,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => (
        <ButtonLink href={`/portal/invoices/${r.id}`} variant="secondary" size="sm">
          View invoice
        </ButtonLink>
      ),
      align: 'right',
    },
  ];

  const linesTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const planFee = plan.price;
  const recurringTotal = planFee + linesTotal;

  const overviewItems = [
    {
      label: 'Plan',
      value: (
        <span>
          {plan.name} <span className="text-xs text-slate-500 capitalize">({plan.billing_period})</span>
        </span>
      ),
    },
    { label: 'Start date', value: date(subscription.start_date) },
    { label: 'Expiry date', value: subscription.expiry_date ? date(subscription.expiry_date) : 'Continuous / Auto-renew' },
    {
      label: 'Next renewal / invoice',
      value: subscription.next_invoice_date ? date(subscription.next_invoice_date) : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/portal', label: 'My subscriptions' }}
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
        description={`Plan: ${plan.name} (${money(recurringTotal)} / ${plan.billing_period})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {allowed_actions.includes('pause') && (
              <Button variant="secondary" size="sm" onClick={() => setPauseOpen(true)} disabled={actionLoading}>
                Pause subscription
              </Button>
            )}

            {allowed_actions.includes('resume') && (
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleAction(() => api.post(`/subscriptions/${id}/resume`))}
              >
                Resume subscription
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

            {allowed_actions.includes('close') && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setCloseOpen(true)}
                disabled={actionLoading}
              >
                Cancel subscription
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
      {subscription.status === 'active' && subscription.pause_reason === 'out_of_term' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <span className="font-semibold">Renewal Needed:</span> Your subscription has ended. Click &ldquo;Renew&rdquo; above to extend by one billing cycle.
        </div>
      )}

      {subscription.status === 'active' && subscription.pause_reason === 'manual' && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="font-semibold">Subscription Paused:</span> Your service is on temporary hold. You can resume anytime without being charged for the paused period.
        </div>
      )}

      <Card>
        <CardHeader title="Subscription details" />
        <CardBody>
          <DescriptionList items={overviewItems} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Plan items &amp; pricing"
          description="Included services, seats and addons."
        />
        <DataTable rows={lines} columns={lineColumns} empty="No items listed." />
        <div className="border-t border-slate-200 bg-slate-50/50 p-4">
          <div className="max-w-xs ml-auto space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Plan fee</span>
              <span className="tabular-nums font-medium text-slate-800">{money(planFee)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Items total</span>
              <span className="tabular-nums font-medium text-slate-800">{money(linesTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900 text-base">
              <span>Total / {plan.billing_period}</span>
              <span className="tabular-nums text-brand-600">{money(recurringTotal)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Invoices"
          description="Invoices issued for this subscription."
        />
        <DataTable rows={invoices} columns={invColumns} empty="No invoices yet." />
      </Card>

      {/* Pause Modal */}
      <Dialog
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause subscription"
        description="Temporarily hold your subscription. Recurring billing will be paused until you resume."
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
        <Field label="Optional note">
          {(fieldId) => (
            <Textarea
              id={fieldId}
              value={pauseNote}
              onChange={(e) => setPauseNote(e.target.value)}
              placeholder="e.g. Vacation hold"
              rows={2}
            />
          )}
        </Field>
      </Dialog>

      {/* Close Modal */}
      <Dialog
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Cancel subscription"
        description="Are you sure you want to cancel this subscription? No further invoices will be generated."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCloseOpen(false)} disabled={actionLoading}>
              Keep subscription
            </Button>
            <Button variant="danger" onClick={handleClose} disabled={actionLoading}>
              {actionLoading ? 'Cancelling...' : 'Confirm cancellation'}
            </Button>
          </>
        }
      >
        <Field label="Reason for cancelling">
          {(fieldId) => (
            <Textarea
              id={fieldId}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="e.g. Project finished"
              rows={2}
            />
          )}
        </Field>
      </Dialog>
    </div>
  );
}
