'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/client/api';
import { useApiList } from '@/lib/client/hooks';
import { today, dateTime, date } from '@/lib/format';
import type { BillingRun } from '@/lib/types';
import {
  PageHeader, Button, Card, CardHeader, CardBody, Stat,
  DataTable, type Column, Badge, Input, Field,
} from '@/components/ui';

function RunResultCard({ run }: { run: BillingRun }) {
  return (
    <Card className="mb-6 border-l-4 border-l-brand-600">
      <CardBody>
        <p className="mb-3 text-sm font-semibold text-slate-700">
          Billing run completed — as of {date(run.as_of)}
        </p>
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Created" value={run.created_count} tone="good" />
          <Stat label="Skipped" value={run.skipped_count} />
          <Stat label="Failed" value={run.failed_count} tone={run.failed_count > 0 ? 'bad' : 'default'} />
        </div>
        {run.failures && run.failures.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-red-700">
              {run.failures.length} failure{run.failures.length > 1 ? 's' : ''} — click to expand
            </summary>
            <ul className="mt-2 space-y-1">
              {run.failures.map((f) => (
                <li key={f.subscription_id} className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">
                  <span className="font-mono font-medium">{f.number}</span> — {f.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardBody>
    </Card>
  );
}

const HISTORY_COLS: Column<BillingRun>[] = [
  {
    key: 'as_of',
    header: 'As of date',
    cell: (r) => date(r.as_of),
  },
  {
    key: 'trigger',
    header: 'Trigger',
    cell: (r) => (
      <Badge tone={r.trigger === 'scheduled' ? 'indigo' : 'gray'}>
        {r.trigger}
      </Badge>
    ),
  },
  { key: 'created_count', header: 'Created', align: 'right', cell: (r) => r.created_count },
  { key: 'skipped_count', header: 'Skipped', align: 'right', cell: (r) => r.skipped_count },
  {
    key: 'failed_count',
    header: 'Failed',
    align: 'right',
    cell: (r) =>
      r.failed_count > 0 ? (
        <span className="font-medium text-red-600">{r.failed_count}</span>
      ) : (
        <span className="text-slate-400">0</span>
      ),
  },
  {
    key: 'started_at',
    header: 'Run at',
    cell: (r) => <span className="text-slate-500 text-xs">{dateTime(r.started_at)}</span>,
  },
];

export default function BillingPage() {
  const [asOf, setAsOf] = useState(today());
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<BillingRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: history, isLoading, mutate } = useApiList<BillingRun>('/billing/runs', { page, page_size: 20 });

  const handleRun = useCallback(async () => {
    setRunning(true);
    setRunError(null);
    setLastRun(null);
    try {
      const run = await api.post<BillingRun>('/billing/run', { as_of: asOf });
      setLastRun(run);
      mutate();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setRunError(err?.message ?? 'Billing run failed');
    } finally {
      setRunning(false);
    }
  }, [asOf, mutate]);

  return (
    <div>
      <PageHeader
        title="Billing runs"
        description="Run billing for all due subscriptions. Each subscription is billed at most once per period."
      />

      {/* Run card */}
      <Card className="mb-6">
        <CardHeader title="Run billing" description="Creates invoices for every subscription due on or before the selected date." />
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <Field label="As of date" className="w-48">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={asOf}
                  onChange={(e) => setAsOf(e.target.value)}
                  max={today()}
                />
              )}
            </Field>
            <Button onClick={handleRun} loading={running} disabled={!asOf}>
              Run billing
            </Button>
          </div>
          {runError && (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{runError}</p>
          )}
        </CardBody>
      </Card>

      {/* Result card from the latest run */}
      {lastRun && <RunResultCard run={lastRun} />}

      {/* History */}
      <Card>
        <CardHeader title="Run history" />
        <DataTable<BillingRun>
          rows={history?.data}
          columns={HISTORY_COLS}
          loading={isLoading}
          empty="No billing runs yet."
        />
      </Card>
    </div>
  );
}
