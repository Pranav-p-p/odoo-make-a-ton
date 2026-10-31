import type { Paged } from '@/lib/types';

export interface PageQuery {
  page: number;
  page_size: number;
}

/** Inclusive row range for Supabase `.range(from, to)`. */
export function rangeOf(q: PageQuery): [number, number] {
  const from = (q.page - 1) * q.page_size;
  return [from, from + q.page_size - 1];
}

export function paged<T>(data: T[] | null, count: number | null, q: PageQuery): Paged<T> {
  return { data: data ?? [], page: q.page, page_size: q.page_size, total: count ?? 0 };
}

/** A user search string as an ILIKE pattern for `.ilike(column, ilikeTerm(q))`. */
export function ilikeTerm(q: string): string {
  return `%${q.replace(/[%_\\]/g, ' ').trim()}%`;
}

/**
 * PostgREST `or` filter matching the search in any of the columns:
 *   q.or(orIlike(['name', 'email'], 'acme ltd'))  →  name.ilike."%acme ltd%",email.ilike."%acme ltd%"
 * Values are double-quoted so commas, spaces and parentheses in the search are safe.
 */
export function orIlike(columns: string[], q: string): string {
  const term = q.replace(/[%_\\"]/g, ' ').trim();
  return columns.map((c) => `${c}.ilike."%${term}%"`).join(',');
}

/** Turns `-created_at` into ['created_at', { ascending: false }], restricted to allowed columns. */
export function sortOf(sort: string | undefined, allowed: string[], fallback: string): [string, { ascending: boolean }] {
  const s = sort && allowed.includes(sort.replace(/^-/, '')) ? sort : fallback;
  return [s.replace(/^-/, ''), { ascending: !s.startsWith('-') }];
}
