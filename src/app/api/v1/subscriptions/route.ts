import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { orIlike } from '@/lib/api/pagination';
import { subscriptionsQuery, createSubscriptionSchema } from '@/lib/validation/s2';
import type { Paged, Subscription, SubscriptionListRow } from '@/lib/types';

export const GET = route({ access: ['admin', 'staff', 'customer'], query: subscriptionsQuery }, async ({ supabase, user, query }) => {
  const page = query?.page ?? 1;
  const pageSize = query?.page_size ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let req = supabase.from('subscription_list').select('*', { count: 'exact' });

  if (user.role === 'customer') {
    if (!user.customer_id) {
      return { data: [], page: 1, page_size: pageSize, total: 0 } satisfies Paged<SubscriptionListRow>;
    }
    req = req.eq('customer_id', user.customer_id).neq('status', 'draft');
  } else if (query?.customer_id) {
    req = req.eq('customer_id', query.customer_id);
  }

  if (query?.status) {
    req = req.eq('status', query.status);
  }

  if (query?.plan_id) {
    req = req.eq('plan_id', query.plan_id);
  }

  if (query?.flag === 'paused') {
    req = req.eq('is_paused', true).eq('pause_reason', 'manual');
  } else if (query?.flag === 'out_of_term') {
    req = req.eq('is_out_of_term', true);
  } else if (query?.flag === 'quote_expired') {
    req = req.eq('quote_expired', true);
  }

  if (query?.q) {
    req = req.or(orIlike(['number', 'customer_name', 'company_name'], query.q));
  }

  const sort = query?.sort ?? '-created_at';
  const desc = sort.startsWith('-');
  const sortCol = desc ? sort.slice(1) : sort;
  req = req.order(sortCol || 'created_at', { ascending: !desc });

  const res = await req.range(from, to);
  if (res.error) unwrap(res);

  return {
    data: (res.data ?? []) as SubscriptionListRow[],
    page,
    page_size: pageSize,
    total: res.count ?? 0,
  } satisfies Paged<SubscriptionListRow>;
});

export const POST = route({ access: ['admin', 'staff'], body: createSubscriptionSchema }, async ({ supabase, body, user }) => {
  if ('from_template_id' in body) {
    const res = await supabase.rpc('create_subscription_from_template', {
      p_template_id: body.from_template_id,
      p_customer_id: body.customer_id,
      p_start: body.start_date,
      p_expiry: body.expiry_date ?? null,
      p_payment_term_id: body.payment_term_id ?? null,
    });
    const sub = unwrap<Subscription>(res);
    return created(sub);
  }

  // Blank / custom subscription creation
  const insertRes = await supabase
    .from('subscriptions')
    .insert({
      customer_id: body.customer_id,
      plan_id: body.plan_id,
      start_date: body.start_date,
      expiry_date: body.expiry_date ?? null,
      payment_term_id: body.payment_term_id ?? null,
      notes: body.notes ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  const sub = unwrap<Subscription>(insertRes);

  if (body.lines && body.lines.length > 0) {
    const linesRes = await supabase.rpc('sub_set_lines', {
      p_id: sub.id,
      p_lines: body.lines,
    });
    const updatedSub = unwrap<Subscription>(linesRes);
    return created(updatedSub);
  }

  return created(sub);
});
