// S2 · Customers and subscriptions (owner: S2). Starter schemas matching SPEC §2–3; S2 extends them.
import { z } from 'zod';
import { email, isoDate, money, name, optionalText, pageQuery, uuid } from './common';

export const customerSchema = z.object({
  name,
  company_name: optionalText,
  email,
  phone: optionalText,
  address: optionalText,
  gstin: optionalText,
});
export const customerProfileSchema = customerSchema.pick({ name: true, phone: true, address: true }).partial(); // portal: no email change

export const createStaffSchema = z.object({ full_name: name, email, role: z.enum(['staff', 'admin']).default('staff') });
export const updateUserSchema = z.object({ role: z.enum(['staff', 'admin']).optional(), is_active: z.boolean().optional() });

export const subscriptionLineSchema = z.object({
  product_id: uuid,
  variant_id: uuid.nullable().optional(),
  quantity: z.coerce.number().positive(),
  unit_price: money.nullable().optional(),
  tax_id: uuid.nullable().optional(),
  description: optionalText,
});
export const setLinesSchema = z.object({ lines: z.array(subscriptionLineSchema) });

export const createSubscriptionSchema = z.union([
  z.object({
    from_template_id: uuid,
    customer_id: uuid,
    start_date: isoDate,
    expiry_date: isoDate.nullable().optional(),
    payment_term_id: uuid.nullable().optional(),
  }),
  z.object({
    customer_id: uuid,
    plan_id: uuid,
    start_date: isoDate,
    expiry_date: isoDate.nullable().optional(),
    payment_term_id: uuid.nullable().optional(),
    notes: optionalText,
    lines: z.array(subscriptionLineSchema).default([]),
  }),
]);
export const transitionSchema = z.object({ to: z.enum(['quotation', 'confirmed', 'active', 'closed']), note: optionalText });
export const pauseSchema = z.object({ note: optionalText });
export const closeSchema = z.object({ reason: optionalText });
export const subscriptionsQuery = pageQuery.extend({
  status: z.enum(['draft', 'quotation', 'confirmed', 'active', 'closed']).optional(),
  plan_id: uuid.optional(),
  customer_id: uuid.optional(),
  flag: z.enum(['paused', 'out_of_term', 'quote_expired']).optional(),
});
