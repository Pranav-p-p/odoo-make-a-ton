import type { SupabaseClient } from '@supabase/supabase-js';
import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { Customer, Plan, PaymentTerm, Product, QuoteTemplate, QuoteTemplateLine, ProductVariant } from '@/lib/types';

// PostgREST caps a response at 1,000 rows, so customers are read page by page.
async function allCustomers(supabase: SupabaseClient): Promise<Customer[]> {
  const pageSize = 1000;
  const { count } = await supabase.from('customers').select('id', { count: 'exact', head: true });
  const pages = Math.max(1, Math.ceil((count ?? 0) / pageSize));
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      supabase.from('customers').select('*').order('name').order('id').range(i * pageSize, (i + 1) * pageSize - 1),
    ),
  );
  return results.flatMap((r) => unwrap<Customer[]>(r));
}

export const GET = route({ access: ['admin', 'staff'] }, async ({ supabase }) => {
  const [customers, plansRes, termsRes, templatesRes, templateLinesRes, productsRes, variantsRes] = await Promise.all([
    allCustomers(supabase),
    supabase.from('plans').select('*').eq('is_active', true).order('name'),
    supabase.from('payment_terms').select('*').eq('is_active', true).order('days'),
    supabase.from('quote_templates').select('*').eq('is_active', true).order('name'),
    supabase.from('quote_template_lines').select('*').order('sort_order'),
    supabase.from('products').select('*').eq('is_active', true).order('name'),
    supabase.from('product_variants').select('*'),
  ]);

  const plans = (plansRes.data ?? []) as Plan[];
  const paymentTerms = (termsRes.data ?? []) as PaymentTerm[];
  const rawTemplates = (templatesRes.data ?? []) as QuoteTemplate[];
  const templateLines = (templateLinesRes.data ?? []) as QuoteTemplateLine[];
  const rawProducts = (productsRes.data ?? []) as Product[];
  const variants = (variantsRes.data ?? []) as ProductVariant[];

  // Attach variants to products
  const products = rawProducts.map((p) => ({
    ...p,
    variants: variants.filter((v) => v.product_id === p.id),
  }));

  // Attach lines to templates
  const templates = rawTemplates.map((t) => ({
    ...t,
    lines: templateLines.filter((l) => l.template_id === t.id),
  }));

  return {
    customers,
    plans,
    payment_terms: paymentTerms,
    templates,
    products,
  };
});
