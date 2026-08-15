import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowedEmail = process.env.ALLOWED_EMAIL?.trim().toLocaleLowerCase('en-US');

if (!url || !serviceRoleKey || !allowedEmail) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ALLOWED_EMAIL are required.',
  );
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: users, error: listError } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});

if (listError) {
  throw listError;
}

const otherUsers = users.users.filter(
  (user) => user.email?.trim().toLocaleLowerCase('en-US') !== allowedEmail,
);

if (otherUsers.length > 0) {
  throw new Error('Refusing to provision: this single-user project already has other Auth users.');
}

if (users.users.length === 0) {
  const { error: createError } = await supabase.auth.admin.createUser({
    email: allowedEmail,
    email_confirm: true,
  });

  if (createError) {
    throw createError;
  }

  console.log(`Provisioned ${allowedEmail}.`);
} else {
  console.log(`${allowedEmail} is already provisioned.`);
}
