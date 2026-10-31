import { z } from 'zod';

export const uuid = z.string().uuid('must be a valid id');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date like 2026-11-01');
/** Money: non-negative, rounded to 2 decimals. */
export const money = z.coerce
  .number({ invalid_type_error: 'must be a number' })
  .nonnegative('cannot be negative')
  .transform((n) => Math.round(n * 100) / 100);
export const positiveQty = z.coerce.number().positive('must be more than 0');
export const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((s) => (s ? s : null));
export const name = z.string().trim().min(1, 'is required').max(200);
export const email = z.string().trim().toLowerCase().email('must be a valid email');
export const boolString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  q: z.string().trim().max(100).optional(),
});

/**
 * The password rule from the brief: more than eight characters (so 9+),
 * with an uppercase letter, a lowercase letter and a special character.
 */
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 9 characters', error: 'needs at least 9 characters', test: (p: string) => p.length >= 9 },
  { id: 'upper', label: 'An uppercase letter', error: 'needs an uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', error: 'needs a lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { id: 'special', label: 'A special character', error: 'needs a special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export const password = z
  .string()
  .max(72, 'must be at most 72 characters')
  .superRefine((p, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.error });
    }
  });
