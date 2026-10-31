import { created, route } from '@/lib/api/handler';
import { errors, unwrap } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendAuthLink } from '@/lib/auth-links';
import { createStaffSchema } from '@/lib/validation/s2';
import type { Profile } from '@/lib/types';
import type { z } from 'zod';

export const GET = route({ access: ['admin'] }, async ({ supabase }) => {
  const res = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'staff'])
    .order('created_at', { ascending: false });

  const profiles = unwrap<Profile[]>(res);
  return profiles;
});

export const POST = route<z.infer<typeof createStaffSchema>>(
  { access: ['admin'], body: createStaffSchema },
  async ({ supabase, body }) => {
    const admin = createAdminClient();

    // Check if email already taken in profiles
    const { data: existing } = await supabase.from('profiles').select('id').eq('email', body.email).maybeSingle();
    if (existing) {
      throw errors.conflict('EMAIL_TAKEN', 'A user with this email already exists');
    }

    // 1. Create auth user with role in app_metadata
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: body.email,
      email_confirm: true,
      app_metadata: { role: body.role },
      user_metadata: { full_name: body.full_name },
    });

    if (authError || !authData.user) {
      if (authError?.message?.includes('already registered')) {
        throw errors.conflict('EMAIL_TAKEN', 'A user with this email already exists');
      }
      throw errors.conflict('USER_CREATION_FAILED', authError?.message ?? 'Failed to create user');
    }

    // Trigger `handle_new_user` creates profile; let's ensure profile role and name are accurate
    await admin
      .from('profiles')
      .update({ role: body.role, full_name: body.full_name })
      .eq('id', authData.user.id);

    // 2. Send invitation / set password link
    const emailResult = await sendAuthLink('recovery', body.email);

    // Fetch the resulting profile
    const profRes = await admin.from('profiles').select('*').eq('id', authData.user.id).single();
    const profile = unwrap<Profile>(profRes);

    return created({
      ...profile,
      email_delivered: emailResult.delivered,
      dev_reset_link: emailResult.devLink,
    });
  },
);
