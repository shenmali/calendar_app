type AuthCallbackInput = {
  userId?: string;
  email: string | null | undefined;
  findActiveAllowedUser?: (input: { userId: string; email: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  upsertProfile?: (profile: { id: string; user_id: string; email: string }) => Promise<void>;
  origin?: string;
};

function redirect(path: string, origin: string | undefined) {
  return Response.redirect(new URL(path, origin ?? 'http://localhost'), 303);
}

export async function handleAuthCallback({
  userId,
  email,
  findActiveAllowedUser,
  signOut,
  upsertProfile,
  origin,
}: AuthCallbackInput) {
  if (!userId || !email || !findActiveAllowedUser) {
    await signOut();
    return redirect('/login?error=unauthorized', origin);
  }

  let isAllowed = false;
  try {
    isAllowed = await findActiveAllowedUser({ userId, email });
  } catch {
    await signOut();
    return redirect('/login?error=unauthorized', origin);
  }

  if (!isAllowed) {
    await signOut();
    return redirect('/login?error=unauthorized', origin);
  }

  if (!upsertProfile) {
    await signOut();
    return redirect('/login?error=auth_callback', origin);
  }

  try {
    await upsertProfile({ id: userId, user_id: userId, email });
  } catch {
    await signOut();
    return redirect('/login?error=auth_callback', origin);
  }

  return redirect('/', origin);
}
