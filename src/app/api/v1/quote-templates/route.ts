import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { activeFilter, templateSchema } from '@/lib/validation/s1';
import { pageQuery } from '@/lib/validation/common';
import type { z } from 'zod';

const templateQuery = pageQuery.extend({ active: activeFilter });
type TemplateQ = z.infer<typeof templateQuery>;

export const GET = route<undefined, TemplateQ>({ access: ['admin', 'staff'], query: templateQuery }, async ({ query, supabase }) => {
  const { page, page_size, q, active } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('quote_templates')
    .select('*, plan:plans(id,name), lines:quote_template_lines(*, product:products(id,name,sales_price), variant:product_variants(id,attribute,value,extra_price))', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (q) qb = qb.ilike('name', `%${q}%`);
  if (active === false) {
    qb = qb.eq('is_active', false);
  } else if (active === 'all') {
    // Show all
  } else {
    // Default: active only
    qb = qb.eq('is_active', true);
  }

  const res = await qb;
  if (res.error) throw unwrap(res);
  return { data: res.data ?? [], page, page_size, total: res.count ?? 0 };
});

export const POST = route({ access: ['admin'], body: templateSchema }, async ({ body, supabase }) => {
  const { lines, ...templateData } = body;

  const templateRes = await supabase.from('quote_templates').insert(templateData).select().single();
  const template = unwrap(templateRes, 'Template') as { id: string };

  if (lines.length > 0) {
    const lineRows = lines.map((l, i) => ({ ...l, template_id: template.id, sort_order: i }));
    const linesRes = await supabase.from('quote_template_lines').insert(lineRows);
    if (linesRes.error) throw unwrap(linesRes);
  }

  const fullRes = await supabase
    .from('quote_templates')
    .select('*, lines:quote_template_lines(*)')
    .eq('id', template.id)
    .single();
  return created(unwrap(fullRes, 'Template'));
});

