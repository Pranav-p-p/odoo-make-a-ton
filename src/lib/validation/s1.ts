// S1 · Commercial setup (owner: S1). Starter schemas matching SPEC §2; S1 extends them.
import { z } from 'zod';
import { boolString, isoDate, money, name, optionalText, pageQuery, uuid } from './common';

export const productType = z.enum(['service', 'software', 'addon', 'other']);
export const billingPeriod = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

export const taxSchema = z.object({ name, rate_percent: z.coerce.number().min(0).max(100), is_active: z.boolean().optional() });
export const paymentTermSchema = z.object({ name, days: z.coerce.number().int().min(0).max(365), is_active: z.boolean().optional() });

export const variantSchema = z.object({ attribute: name, value: name, extra_price: money.default(0) });
export const productSchema = z.object({
  name,
  type: productType.default('service'),
  sales_price: money,
  cost_price: money.default(0),
  notes: optionalText,
  default_tax_id: uuid.nullable().optional(),
  is_active: z.boolean().optional(),
  variants: z.array(variantSchema).optional(),
});
export const productsQuery = pageQuery.extend({ type: productType.optional(), active: boolString.optional() });

export const planSchema = z
  .object({
    name,
    price: money,
    billing_period: billingPeriod,
    min_quantity: z.coerce.number().int().min(1).default(1),
    available_from: isoDate,
    available_to: isoDate.nullable().optional(),
    auto_close: z.boolean().default(false),
    allow_early_close: z.boolean().default(true),
    allow_pause: z.boolean().default(false),
    allow_renew: z.boolean().default(true),
    tax_id: uuid.nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((p) => !p.available_to || p.available_to >= p.available_from, { path: ['available_to'], message: 'must be on or after available from' });

export const templateSchema = z.object({
  name,
  plan_id: uuid,
  validity_days: z.coerce.number().int().min(1).max(365),
  notes: optionalText,
  is_active: z.boolean().optional(),
  lines: z.array(z.object({ product_id: uuid, variant_id: uuid.nullable().optional(), quantity: z.coerce.number().positive() })).min(1),
});

export const discountRuleSchema = z
  .object({
    name,
    kind: z.enum(['percent', 'fixed']),
    value: z.coerce.number().positive(),
    scope: z.enum(['products', 'subscription']),
    product_ids: z.array(uuid).default([]),
    condition: z.enum(['none', 'min_purchase', 'min_quantity']).default('none'),
    condition_value: z.coerce.number().positive().nullable().optional(),
    starts_on: isoDate,
    ends_on: isoDate.nullable().optional(),
    usage_limit: z.coerce.number().int().positive().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => d.kind !== 'percent' || d.value <= 100, { path: ['value'], message: 'a percentage cannot exceed 100' })
  .refine((d) => d.condition === 'none' || d.condition_value != null, { path: ['condition_value'], message: 'is required for this condition' })
  .refine((d) => d.scope !== 'products' || d.product_ids.length > 0, { path: ['product_ids'], message: 'pick at least one product' })
  .refine((d) => !d.ends_on || d.ends_on >= d.starts_on, { path: ['ends_on'], message: 'must be on or after the start date' });
