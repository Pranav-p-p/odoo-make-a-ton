import { route } from '@/lib/api/handler';
import { errors, unwrap, zodDetails } from '@/lib/api/errors';
import { customerProfileSchema, updateCustomerSchema } from '@/lib/validation/s2';
import type { Customer, SubscriptionListRow, InvoiceListRow } from '@/lib/types';

export const GET = route<undefined, undefined, { id: string }>({ access: ['admin', 'staff', 'customer'] }, async ({ supabase, user, params }) => {
  const id = params.id;
  if (user.role === 'customer' && user.customer_id !== id) {
    throw errors.notFound('Customer');
  }

  const custRes = await supabase.from('customers').select('*').eq('id', id).single();
  const customer = unwrap<Customer>(custRes, 'Customer');

  // Subscriptions for this customer
  let subsReq = supabase
    .from('subscription_list')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (user.role === 'customer') {
    subsReq = subsReq.neq('status', 'draft');
  }
  const subsRes = await subsReq;

  // Invoices for this customer
  let invReq = supabase
    .from('invoice_list')
    .select('*')
    .eq('customer_id', id)
    .order('invoice_date', { ascending: false })
    .limit(50);
  if (user.role === 'customer') {
    invReq = invReq.neq('status', 'draft');
  }
  const invRes = await invReq;

  return {
    ...customer,
    subscriptions: (subsRes.data ?? []) as SubscriptionListRow[],
    invoices: (invRes.data ?? []) as InvoiceListRow[],
  };
});

export const PATCH = route<unknown, undefined, { id: string }>({ access: ['admin', 'staff', 'customer'] }, async ({ req, supabase, user, params }) => {
  const id = params.id;
  if (user.role === 'customer' && user.customer_id !== id) {
    throw errors.notFound('Customer');
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw errors.validation({ body: ['Request body must be valid JSON'] });
  }

  let patchData: Record<string, unknown>;
  if (user.role === 'customer') {
    const parsed = customerProfileSchema.safeParse(json);
    if (!parsed.success) throw errors.validation(zodDetails(parsed.error));
    patchData = parsed.data;
  } else {
    const parsed = updateCustomerSchema.safeParse(json);
    if (!parsed.success) throw errors.validation(zodDetails(parsed.error));
    patchData = parsed.data;
  }

  const res = await supabase.from('customers').update(patchData).eq('id', id).select().single();
  const customer = unwrap<Customer>(res, 'Customer');
  return customer;
});
