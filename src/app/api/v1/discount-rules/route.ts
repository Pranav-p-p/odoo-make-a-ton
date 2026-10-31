import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { discountRuleSchema } from '@/lib/validation/s1';
import { pageQuery, boolString } from '@/lib/validation/common';
import { z } from 'zod';

const discountQuery = pageQuery.extend({ active: boolString.optional() });
type DiscountQ = z.infer<typeof discountQuery>;

export const GET = route<undefined, DiscountQ>({ access: ['admin', 'staff'], query: discountQuery }, async ({ query, supabase }) => {
  const { page, page_size, q, active } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('discount_rules')
    .select('*, product_ids:discount_rule_products(product_id)', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (q) qb = qb.ilike('name', `%${q}%`);
  if (active !== undefined) qb = qb.eq('is_active', active);

  const res = await qb;
  if (res.error) throw unwrap(res);

  // Flatten product_ids from join rows
  const data = (res.data ?? []).map((r: { product_ids: { product_id: string }[] } & object) => ({
    ...r,
    product_ids: r.product_ids.map((p) => p.product_id),
  }));

  return { data, page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: discountRuleSchema }, async ({ body, user, supabase }) => {
  const { product_ids, ...ruleData } = body;

  const ruleRes = await supabase
    .from('discount_rules')
    .insert({ ...ruleData, created_by: user.id })
    .select()
    .single();
  const rule = unwrap(ruleRes, 'Discount rule') as { id: string };

  // Insert product associations if scope = products
  if (ruleData.scope === 'products' && product_ids.length > 0) {
    const rows = product_ids.map((pid) => ({ rule_id: rule.id, product_id: pid }));
    const prodRes = await supabase.from('discount_rule_products').insert(rows);
    if (prodRes.error) throw unwrap(prodRes);
  }

  const fullRes = await supabase
    .from('discount_rules')
    .select('*, product_ids:discount_rule_products(product_id)')
    .eq('id', rule.id)
    .single();
  const full = unwrap(fullRes, 'Discount rule') as { product_ids: { product_id: string }[] } & object;
  return created({ ...full, product_ids: full.product_ids.map((p) => p.product_id) });
});

