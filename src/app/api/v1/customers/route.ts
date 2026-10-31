import { created, route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { pageQuery } from '@/lib/validation/common';
import { orIlike } from '@/lib/api/pagination';
import { customerSchema } from '@/lib/validation/s2';
import type { Customer, Paged } from '@/lib/types';

export const GET = route({ access: ['admin', 'staff', 'customer'], query: pageQuery }, async ({ supabase, user, query }) => {
  if (user.role === 'customer') {
    if (!user.customer_id) {
      return { data: [], page: 1, page_size: 20, total: 0 } satisfies Paged<Customer>;
    }
    const res = await supabase.from('customers').select('*').eq('id', user.customer_id).single();
    const c = unwrap<Customer>(res, 'Customer');
    return { data: [c], page: 1, page_size: 20, total: 1 } satisfies Paged<Customer>;
  }

  const page = query?.page ?? 1;
  const pageSize = query?.page_size ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let req = supabase.from('customers').select('*', { count: 'exact' });

  if (query?.q) {
    req = req.or(orIlike(['name', 'email', 'company_name'], query.q));
  }

  const sort = query?.sort ?? '-created_at';
  const desc = sort.startsWith('-');
  const sortCol = desc ? sort.slice(1) : sort;
  req = req.order(sortCol || 'created_at', { ascending: !desc });

  const res = await req.range(from, to);
  if (res.error) unwrap(res);

  return {
    data: (res.data ?? []) as Customer[],
    page,
    page_size: pageSize,
    total: res.count ?? 0,
  } satisfies Paged<Customer>;
});

export const POST = route({ access: ['admin', 'staff'], body: customerSchema }, async ({ supabase, body, user }) => {
  const res = await supabase
    .from('customers')
    .insert({
      name: body.name,
      company_name: body.company_name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      gstin: body.gstin,
      created_by: user.id,
    })
    .select()
    .single();

  const customer = unwrap<Customer>(res);
  return created(customer);
});
