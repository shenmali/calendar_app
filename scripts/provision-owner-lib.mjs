function normalizeEmail(email) {
  return email.trim().toLocaleLowerCase('en-US');
}

export async function provisionOwner({
  ownerEmail,
  listUsers,
  createUser,
  upsertAllowedUser,
}) {
  const email = ownerEmail?.trim() ? normalizeEmail(ownerEmail) : null;
  if (!email) {
    throw new Error('OWNER_EMAIL is required.');
  }

  const users = await listUsers();
  let user = users.find((candidate) => normalizeEmail(candidate.email ?? '') === email);
  let createdAuthUser = false;

  if (!user) {
    user = await createUser({ email, email_confirm: true });
    createdAuthUser = true;
  }

  if (!user?.id) {
    throw new Error('Owner Auth user could not be provisioned.');
  }

  await upsertAllowedUser({
    user_id: user.id,
    email,
    role: 'owner',
    status: 'active',
    revoked_at: null,
  });

  return { createdAuthUser };
}
