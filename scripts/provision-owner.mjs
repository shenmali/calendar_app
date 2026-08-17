import { createClient } from '@supabase/supabase-js';
import { provisionOwner } from './provision-owner-lib.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL;

if (!url || !serviceRoleKey || !ownerEmail?.trim()) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OWNER_EMAIL are required.');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
    page += 1;
  }
}

await provisionOwner({
  ownerEmail,
  listUsers,
  createUser: async (input) => {
    const { data, error } = await supabase.auth.admin.createUser(input);
    if (error) throw error;
    if (!data.user) throw new Error('Owner Auth user could not be provisioned.');
    return data.user;
  },
  upsertAllowedUser: async (owner) => {
    const { error } = await supabase.from('allowed_users').upsert(owner, { onConflict: 'user_id' });
    if (error) throw error;
  },
});

console.log('Owner account provisioned.');
