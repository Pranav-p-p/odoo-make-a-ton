// Client for /api/v1. Pages call these instead of fetch() or Supabase directly.
//
//   const run = await api.post<BillingRun>('/billing/run', { as_of: '2026-10-31' });
//   const list = await api.get<Paged<InvoiceListRow>>('/invoices', { status: 'draft', page: 1 });
//
// Core owns this file. Slices may add typed wrappers in their own folder (e.g. src/components/s3/api.ts)
// on top of api.get / post / patch / put / del.
//
// Every function throws ApiClientError on a non-2xx answer; show it with `errorMessage(e)`.
import type { SessionUser } from '@/lib/types';

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: Record<string, string[]> | Record<string, unknown> = {},
  ) {
    super(message);
  }
  /** Field errors from a 400 VALIDATION_ERROR, e.g. { password: ['needs an uppercase letter'] } */
  get fieldErrors(): Record<string, string[]> {
    return this.code === 'VALIDATION_ERROR' ? (this.details as Record<string, string[]>) : {};
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function toQueryString(query?: Query): string {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/v1${path}${toQueryString(opts.query)}`, {
    method,
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiClientError(res.status, e.code ?? 'INTERNAL', e.message ?? res.statusText, e.details ?? {});
  }
  return json as T;
}


const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, { body });

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body: unknown = {}) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, { body }),
  del: <T>(path: string) => request<T>('DELETE', path),

  auth: {
    /** Creates an unconfirmed account and emails a confirmation link. No session until confirmed. */
    signup: (b: { full_name: string; email: string; password: string }) =>
      post<{ status: 'confirmation_sent'; email: string; email_delivered: boolean; dev_confirm_link?: string }>('/auth/signup', b),
    login: (b: { email: string; password: string }) => post<{ user: SessionUser }>('/auth/login', b),
    logout: () => post<{ ok: true }>('/auth/logout'),
    forgotPassword: (email: string) => post<{ ok: true; message: string; dev_reset_link?: string }>('/auth/forgot-password', { email }),
    /** With tokenHash (from the email link) or, without it, for the signed-in user. Signs in on success. */
    resetPassword: (password: string, tokenHash?: string) =>
      post<{ ok: true; user: SessionUser }>('/auth/reset-password', { password, ...(tokenHash ? { token_hash: tokenHash } : {}) }),
  },
  me: () => request<SessionUser>('GET', '/me'),
};

export type PageQuery = { page?: number; page_size?: number; sort?: string; q?: string };
