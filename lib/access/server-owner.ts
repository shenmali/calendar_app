import { AccessError, requireActiveOwner } from '@/lib/access/owner-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export { AccessError };

export async function getCurrentActiveOwner() {
  const sessionClient = await createClient();
  const { data: { user }, error: userError } = await sessionClient.auth.getUser();
  const admin = createAdminClient();

  return requireActiveOwner({
    getCurrentUser: async () => userError || !user ? null : { id: user.id },
    findAllowedUser: async (userId) => {
      const { data, error } = await admin
        .from('allowed_users')
        .select('role, status')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
