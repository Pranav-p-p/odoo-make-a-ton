import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import type { Customer, Plan, PaymentTerm, Product, QuoteTemplate, QuoteTemplateLine, ProductVariant } from '@/lib/types';

export const GET = route({ access: ['admin', 'staff'] }, async ({ supabase }) => {
  const [customersRes, plansRes, termsRes, templatesRes, templateLinesRes, productsRes, variantsRes] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase.from('plans').select('*').eq('is_active', true).order('name'),
    supabase.from('payment_terms').select('*').eq('is_active', true).order('days'),
    supabase.from('quote_templates').select('*').eq('is_active', true).order('name'),
    supabase.from('quote_template_lines').select('*').order('sort_order'),
    supabase.from('products').select('*').eq('is_active', true).order('name'),
    supabase.from('product_variants').select('*'),
  ]);

  const customers = (customersRes.data ?? []) as Customer[];
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
