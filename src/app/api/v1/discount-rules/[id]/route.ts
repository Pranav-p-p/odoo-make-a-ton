import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { discountRuleSchema } from '@/lib/validation/s1';
import { z } from 'zod';
import { isoDate, money, name, uuid } from '@/lib/validation/common';

// PATCH body: partial version of the discount rule fields (without cross-field refines).
const discountPatchSchema = z.object({
  name: name.optional(),
  kind: z.enum(['percent', 'fixed']).optional(),
  value: money.optional(),
  scope: z.enum(['products', 'subscription']).optional(),
  product_ids: z.array(uuid).optional(),
  condition: z.enum(['none', 'min_purchase', 'min_quantity']).optional(),
  condition_value: z.coerce.number().positive().nullable().optional(),
  starts_on: isoDate.optional(),
  ends_on: isoDate.nullable().optional(),
  usage_limit: z.coerce.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const GET = route({ access: ['admin', 'staff'] }, async ({ params, supabase }) => {
  const res = await supabase
    .from('discount_rules')
    .select('*, product_ids:discount_rule_products(product_id)')
    .eq('id', params.id)
    .single();
  if (res.error) throw unwrap(res);
  const data = res.data as { product_ids: { product_id: string }[] } & object;
  return { ...data, product_ids: data.product_ids.map((p) => p.product_id) };
});

export const PATCH = route({ access: ['admin'], body: discountPatchSchema }, async ({ body, params, supabase }) => {
  const { product_ids, ...ruleData } = body;

  if (Object.keys(ruleData).length > 0) {
    const res = await supabase.from('discount_rules').update(ruleData).eq('id', params.id).select().single();
    if (res.error) throw unwrap(res);
  }

  // Replace product associations if provided
  if (product_ids !== undefined) {
    await supabase.from('discount_rule_products').delete().eq('rule_id', params.id);
    if (product_ids.length > 0) {
      const rows = product_ids.map((pid) => ({ rule_id: params.id, product_id: pid }));
      const prodRes = await supabase.from('discount_rule_products').insert(rows);
      if (prodRes.error) throw unwrap(prodRes);
    }
  }

  const fullRes = await supabase
    .from('discount_rules')
    .select('*, product_ids:discount_rule_products(product_id)')
    .eq('id', params.id)
    .single();
  if (fullRes.error) throw unwrap(fullRes);
  const data = fullRes.data as { product_ids: { product_id: string }[] } & object;
  return { ...data, product_ids: data.product_ids.map((p) => p.product_id) };
});

