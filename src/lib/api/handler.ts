import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZodType, ZodTypeDef } from 'zod';
import { createClient, createTokenClient } from '@/lib/supabase/server';
import { loadSessionUser } from '@/lib/auth';
import { errors, toErrorResponse, zodDetails } from '@/lib/api/errors';
import type { Role, SessionUser } from '@/lib/types';

/** Who may call a route: anyone, any signed-in user, or a list of roles. */
export type Access = 'public' | 'any' | Role[];

export interface RouteContext<B, Q, P> {
  req: NextRequest;
  body: B;
  query: Q;
  params: P;
  /** Supabase client acting as the caller: every query is filtered by RLS. */
  supabase: SupabaseClient;
  /** The caller. Null only on 'public' routes. */
  user: SessionUser;
}

type Schema<T> = ZodType<T, ZodTypeDef, unknown>;

interface RouteOptions<B, Q> {
  access: Access;
  body?: Schema<B>;
  query?: Schema<Q>;
}

/**
 * Wraps a route handler with: session loading (cookie or Bearer token), the role check,
 * zod validation of the JSON body and query string, and uniform error responses.
 *
 *   export const POST = route({ access: ['admin'], body: createPlanSchema }, async ({ body, supabase }) => { ... });
 *
 * Return a plain object to send it as JSON (200), or use `created()` / any NextResponse.
 */
export function route<B = undefined, Q = undefined, P extends Record<string, string> = Record<string, string>>(
  opts: RouteOptions<B, Q>,
  handler: (ctx: RouteContext<B, Q, P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = ((await context?.params) ?? {}) as P;

      const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
      const supabase = bearer ? createTokenClient(bearer) : await createClient();

      let user: SessionUser | null = null;
      if (opts.access !== 'public') {
        user = await loadSessionUser(supabase, bearer);
        if (!user) throw errors.unauthenticated();
        if (Array.isArray(opts.access) && !opts.access.includes(user.role)) throw errors.forbidden();
      }

      let query = undefined as Q;
      if (opts.query) {
        const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
        // Treat empty strings as "not provided" so `?plan_id=` works from forms.
        for (const k of Object.keys(raw)) if (raw[k] === '') delete raw[k];
        const parsed = opts.query.safeParse(raw);
        if (!parsed.success) throw errors.validation(zodDetails(parsed.error), 'Invalid query parameters');
        query = parsed.data;
      }

      let body = undefined as B;
      if (opts.body) {
        let json: unknown;
        try {
          json = await req.json();
        } catch {
          throw errors.validation({ body: ['Request body must be valid JSON'] });
        }
        const parsed = opts.body.safeParse(json);
        if (!parsed.success) throw errors.validation(zodDetails(parsed.error));
        body = parsed.data;
      }

      const result = await handler({ req, body, query, params, supabase, user: user as SessionUser });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export const created = (data: unknown) => NextResponse.json(data, { status: 201 });

export function assertInternal(user: SessionUser) {
  if (user.role === 'customer') throw errors.forbidden();
}
