import { isAllowedEmail } from '@/lib/security/allowed-email';

type AuthCallbackInput = {
  userId?: string;
  email: string | null | undefined;
  allowedEmail: string | undefined;
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
  allowedEmail,
  signOut,
  upsertProfile,
  origin,
}: AuthCallbackInput) {
  if (!userId || !email || !allowedEmail || !isAllowedEmail(email, allowedEmail)) {
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
