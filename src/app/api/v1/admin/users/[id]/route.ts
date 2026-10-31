import { route } from '@/lib/api/handler';
import { unwrap } from '@/lib/api/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { updateUserSchema } from '@/lib/validation/s2';
import type { Profile } from '@/lib/types';
import type { z } from 'zod';

export const PATCH = route<z.infer<typeof updateUserSchema>, undefined, { id: string }>(
  { access: ['admin'], body: updateUserSchema },
  async ({ params, body }) => {
    const admin = createAdminClient();
    const id = params.id;

    const updates: Record<string, unknown> = {};
    if (body.role !== undefined) updates.role = body.role;
    if (body.is_active !== undefined) updates.is_active = body.is_active;

    // Update profile
    const profRes = await admin.from('profiles').update(updates).eq('id', id).select().single();
    const profile = unwrap<Profile>(profRes, 'Profile');

    // Sync role and ban status in Supabase Auth
    const authUpdates: Record<string, unknown> = {};
    if (body.role !== undefined) {
      authUpdates.app_metadata = { role: body.role };
    }
    if (body.is_active !== undefined) {
      authUpdates.ban_duration = body.is_active ? 'none' : '876600h';
    }

    if (Object.keys(authUpdates).length > 0) {
      await admin.auth.admin.updateUserById(id, authUpdates);
    }

    return profile;
  },
);
