import { route } from '@/lib/api/handler';
import { errors, unwrap } from '@/lib/api/errors';
import { updateSubscriptionHeaderSchema } from '@/lib/validation/s2';
import type {
  Subscription,
  Customer,
  Plan,
  PaymentTerm,
  SubscriptionLine,
  SubscriptionAction,
  StatusHistoryRow,
  InvoiceListRow,
} from '@/lib/types';

export interface SubscriptionDetail {
  subscription: Subscription;
  customer: Customer;
  plan: Plan;
  payment_term: PaymentTerm | null;
  lines: SubscriptionLine[];
  allowed_actions: SubscriptionAction[];
  history: (StatusHistoryRow & { changer_name?: string })[];
  invoices: InvoiceListRow[];
}

export const GET = route<undefined, undefined, { id: string }>({ access: ['admin', 'staff', 'customer'] }, async ({ supabase, user, params }) => {
  const id = params.id;

  // 1. Fetch subscription
  const subRes = await supabase.from('subscriptions').select('*').eq('id', id).single();
  const subscription = unwrap<Subscription>(subRes, 'Subscription');

  // Customer authorization check: customers can only view their own non-draft subscriptions
  if (user.role === 'customer') {
    if (subscription.customer_id !== user.customer_id || subscription.status === 'draft') {
      throw errors.notFound('Subscription');
    }
  }

  // 2. Fetch customer, plan, payment term, lines, allowed actions, history, invoices in parallel
  const [custRes, planRes, termRes, linesRes, actionsRes, historyRes, profilesRes, invRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', subscription.customer_id).single(),
    supabase.from('plans').select('*').eq('id', subscription.plan_id).single(),
    subscription.payment_term_id
      ? supabase.from('payment_terms').select('*').eq('id', subscription.payment_term_id).single()
      : Promise.resolve({ data: null, error: null }),
    supabase.from('subscription_lines').select('*').eq('subscription_id', id).order('sort_order'),
    supabase.rpc('sub_allowed_actions', { p_id: id }),
    supabase.from('subscription_status_history').select('*').eq('subscription_id', id).order('changed_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, email'),
    supabase.from('invoice_list').select('*').eq('subscription_id', id).order('invoice_date', { ascending: false }),
  ]);

  const customer = unwrap<Customer>(custRes, 'Customer');
  const plan = unwrap<Plan>(planRes, 'Plan');
  const payment_term = termRes.data ? (termRes.data as PaymentTerm) : null;
  const lines = (linesRes.data ?? []) as SubscriptionLine[];
  const allowed_actions = (actionsRes.data ?? []) as SubscriptionAction[];
  const rawHistory = (historyRes.data ?? []) as StatusHistoryRow[];
  const profiles = (profilesRes.data ?? []) as { id: string; full_name: string; email: string }[];
  let invoices = (invRes.data ?? []) as InvoiceListRow[];

  if (user.role === 'customer') {
    invoices = invoices.filter((i) => i.status !== 'draft');
  }

  // Map changer name to history
  const profileMap = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));
  const history = rawHistory.map((h) => ({
    ...h,
    changer_name: h.changed_by ? profileMap.get(h.changed_by) ?? 'System' : 'System',
  }));

  return {
    subscription,
    customer,
    plan,
    payment_term,
    lines,
    allowed_actions,
    history,
    invoices,
  } satisfies SubscriptionDetail;
});

export const PATCH = route<import('zod').infer<typeof updateSubscriptionHeaderSchema>, undefined, { id: string }>(
  { access: ['admin', 'staff'], body: updateSubscriptionHeaderSchema },
  async ({ supabase, params, body }) => {
  const id = params.id;

  const res = await supabase
    .from('subscriptions')
    .update({
      customer_id: body.customer_id,
      plan_id: body.plan_id,
      start_date: body.start_date,
      expiry_date: body.expiry_date,
      payment_term_id: body.payment_term_id,
      notes: body.notes,
    })
    .eq('id', id)
    .select()
    .single();

  const updated = unwrap<Subscription>(res, 'Subscription');
  return updated;
});
