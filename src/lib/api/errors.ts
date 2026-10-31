import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/** Every API error response has this shape: { error: { code, message, details } } */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const errors = {
  validation: (details: unknown, message = 'Some fields are invalid') => new ApiError(400, 'VALIDATION_ERROR', message, details),
  unauthenticated: () => new ApiError(401, 'UNAUTHENTICATED', 'Please sign in'),
  forbidden: (message = 'You are not allowed to do this') => new ApiError(403, 'FORBIDDEN', message),
  notFound: (what = 'Record') => new ApiError(404, 'NOT_FOUND', `${what} not found`),
  conflict: (code: string, message?: string, details?: unknown) => new ApiError(409, code, message ?? code, details),
};

interface PgLikeError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

/** Unique constraints that deserve a specific error code. */
const UNIQUE_CODES: Record<string, string> = {
  customers_email_key: 'EMAIL_TAKEN',
  customers_user_id_key: 'EMAIL_TAKEN',
  profiles_email_key: 'EMAIL_TAKEN',
  invoices_one_per_period: 'ALREADY_BILLED',
  product_variants_product_id_attribute_value_key: 'VARIANT_EXISTS',
  taxes_name_key: 'NAME_TAKEN',
  payment_terms_name_key: 'NAME_TAKEN',
};

/**
 * Maps a Postgres / PostgREST error to an API error.
 * Business-rule exceptions raised in the SQL functions use SQLSTATE P0001 and a message
 * like "INVALID_TRANSITION: active -> quotation"; the part before ":" becomes the error code.
 */
export function fromPostgres(err: PgLikeError): ApiError {
  const code = err.code ?? '';
  const msg = err.message ?? 'Database error';
  switch (code) {
    case '42501':
      if (msg.startsWith('FORBIDDEN:')) return errors.forbidden(msg.slice('FORBIDDEN:'.length).trim());
      return errors.forbidden(msg.includes('row-level security') ? 'You are not allowed to change this record' : undefined);
    case 'P0002':
    case 'PGRST116':
      return errors.notFound();
    case 'P0001': {
      const m = /^([A-Z][A-Z0-9_]+)(?::\s*(.*))?$/.exec(msg.trim());
      if (m?.[1] === 'VALIDATION_ERROR') return errors.validation({ _: [m[2] ?? msg] }, m[2] ?? msg);
      return new ApiError(409, m ? m[1] : 'BUSINESS_RULE', msg, m?.[2] ? { value: m[2] } : undefined);
    }
    case '23505': {
      const constraint = Object.keys(UNIQUE_CODES).find((c) => msg.includes(c) || err.details?.includes(c));
      return errors.conflict(constraint ? UNIQUE_CODES[constraint] : 'DUPLICATE', msg);
    }
    case '23503':
      return errors.conflict('IN_USE', 'This record is referenced by other records and cannot be removed');
    case '23514':
    case '23502':
    case '22P02':
    case '22023':
    case '22007':
    case '22008':
      return errors.validation({ database: [msg] }, msg);
    default:
      return new ApiError(500, 'INTERNAL', msg);
  }
}

/**
 * Throws the mapped error if a Supabase result has one, otherwise returns its data.
 * The database client is untyped, so results are `any` unless you pass a type: unwrap<Plan>(res).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function unwrap<T = any>(res: { data: unknown; error: PgLikeError | null }, notFoundWhat?: string): T {
  if (res.error) throw fromPostgres(res.error);
  if (res.data === null && notFoundWhat) throw errors.notFound(notFoundWhat);
  return res.data as T;
}

export function zodDetails(e: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of e.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function toErrorResponse(e: unknown): NextResponse {
  let err: ApiError;
  if (e instanceof ApiError) err = e;
  else if (e instanceof ZodError) err = errors.validation(zodDetails(e));
  else {
    console.error('[api] unexpected error', e);
    err = new ApiError(500, 'INTERNAL', 'Something went wrong');
  }
  if (err.status >= 500) console.error('[api]', err.code, err.message);
  return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details ?? {} } }, { status: err.status });
}
