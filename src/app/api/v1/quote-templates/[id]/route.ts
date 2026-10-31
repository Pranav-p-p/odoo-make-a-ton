import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { templateSchema } from '@/lib/validation/s1';

export const GET = route({ access: ['admin', 'staff'] }, async ({ params, supabase }) => {
  const res = await supabase
    .from('quote_templates')
    .select('*, lines:quote_template_lines(*, product:products(id,name,sales_price), variant:product_variants(id,attribute,value,extra_price))')
    .eq('id', params.id)
    .single();
  return unwrap<object>(res, 'Template');
});

export const PATCH = route({ access: ['admin'], body: templateSchema.partial() }, async ({ body, params, supabase }) => {
  const { lines, ...headerData } = body;

  // Update header
  if (Object.keys(headerData).length > 0) {
    const res = await supabase.from('quote_templates').update(headerData).eq('id', params.id).select().single();
    if (res.error) throw unwrap(res);
  }

  // Replace lines if provided
  if (lines !== undefined) {
    await supabase.from('quote_template_lines').delete().eq('template_id', params.id);
    if (lines.length > 0) {
      const lineRows = lines.map((l, i) => ({ ...l, template_id: params.id, sort_order: i }));
      const linesRes = await supabase.from('quote_template_lines').insert(lineRows);
      if (linesRes.error) throw unwrap(linesRes);
    }
  }

  const fullRes = await supabase
    .from('quote_templates')
    .select('*, lines:quote_template_lines(*)')
    .eq('id', params.id)
    .single();
  return unwrap(fullRes, 'Template');
});

