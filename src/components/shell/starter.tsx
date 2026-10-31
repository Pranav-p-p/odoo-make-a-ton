import { createClient } from '@/lib/supabase/server';
import { Badge, Card, CardBody, CardHeader, PageHeader } from '@/components/ui';

/**
 * Placeholder screen shipped by Core so every route exists from minute one.
 * The owning slice replaces the page that renders this (see docs/phase2/<slice>.md).
 * It shows a live row count read with the signed-in user's permissions, which proves
 * the seed, the session and Row Level Security work for that role.
 */
export async function StarterPage({
  title,
  slice,
  ids,
  source,
  todo,
}: {
  title: string;
  slice: 'S1' | 'S2' | 'S3' | 'S4';
  ids: string;
  /** Table or view to count rows from, with the caller's RLS. */
  source?: string;
  todo: string[];
}) {
  let count: number | null = null;
  let error: string | null = null;
  if (source) {
    const supabase = await createClient();
    const res = await supabase.from(source).select('*', { count: 'exact', head: true });
    count = res.count;
    error = res.error?.message ?? null;
  }
  const file = { S1: 'S1-catalog', S2: 'S2-subscriptions', S3: 'S3-billing', S4: 'S4-finance' }[slice];
  return (
    <div>
      <PageHeader title={title} description={`Owned by ${slice} · ${ids}`} actions={<Badge tone="amber">Starter page</Badge>} />
      <Card>
        <CardHeader title="To build here" description={`See docs/phase2/${file}.md for the full instructions.`} />
        <CardBody>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {todo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {source && (
            <p className="mt-4 text-sm text-slate-500">
              Live data check: <code>{source}</code> has{' '}
              {error ? <span className="text-red-600">error: {error}</span> : <strong>{count?.toLocaleString('en-IN') ?? 0}</strong>} rows
              visible to you.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
