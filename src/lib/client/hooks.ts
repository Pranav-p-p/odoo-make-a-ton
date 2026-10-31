'use client';

// Data hooks for pages. They cache, dedupe and revalidate (SWR).
//
//   const { data, isLoading, error, mutate } = useApi<SubscriptionDetail>(`/subscriptions/${id}`);
//   const list = useApiList<InvoiceListRow>('/invoices', { status: 'draft', page });
//
// After a mutation, call `mutate()` (this view) or `refresh('/invoices')` (every view under a path).
import useSWR, { useSWRConfig } from 'swr';
import { useCallback } from 'react';
import { request, toQueryString, type ApiClientError } from '@/lib/client/api';
import type { Paged } from '@/lib/types';

type Query = Record<string, string | number | boolean | null | undefined>;

const fetcher = <T>(key: string) => request<T>('GET', key);

/** GET /api/v1{path}{query}. Pass path = null to skip (e.g. while an id is not known yet). */
export function useApi<T>(path: string | null, query?: Query) {
  const key = path ? `${path}${toQueryString(query)}` : null;
  return useSWR<T, ApiClientError>(key, fetcher, { keepPreviousData: true });
}

/** Same as useApi for paginated list endpoints: { data, page, page_size, total }. */
export function useApiList<T>(path: string | null, query?: Query) {
  return useApi<Paged<T>>(path, query);
}

/** Revalidates every cached GET whose path starts with the prefix, e.g. refresh('/invoices'). */
export function useRefresh() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (prefix: string) => mutate((key) => typeof key === 'string' && key.startsWith(prefix), undefined, { revalidate: true }),
    [mutate],
  );
}
