import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { templateSchema } from '@/lib/validation/s1';
import { pageQuery } from '@/lib/validation/common';
import type { z } from 'zod';

type PageQ = z.infer<typeof pageQuery>;

export const GET = route<undefined, PageQ>({ access: ['admin', 'staff'], query: pageQuery }, async ({ query, supabase }) => {
  const { page, page_size, q } = query;
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  let qb = supabase
    .from('quote_templates')
    .select('*, lines:quote_template_lines(*, product:products(id,name,sales_price), variant:product_variants(id,attribute,value,extra_price))', { count: 'exact' })
    .eq('is_active', true)
    .order('name')
    .range(from, to);

  if (q) qb = qb.ilike('name', `%${q}%`);

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

