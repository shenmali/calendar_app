import { NextRequest, NextResponse } from 'next/server';
import { handleAuthCallback } from '@/lib/auth/callback';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

function redirectToLogin(request: NextRequest, error: 'auth_callback' | 'unauthorized') {
  const url = new URL('/login', request.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');

  if (!code) {
    return redirectToLogin(request, 'auth_callback');
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectToLogin(request, 'auth_callback');
  }

  // getUser validates the current user with Supabase after the code exchange.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userError ? null : userData.user;

  return handleAuthCallback({
    userId: user?.id,
    email: user?.email,
    allowedEmail: process.env.ALLOWED_EMAIL,
    origin: request.nextUrl.origin,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    upsertProfile: async (profile) => {
      const { error } = await createAdminClient()
        .from('profiles')
        .upsert(profile, { onConflict: 'id' });

      if (error) {
        throw error;
      }
    },
  });
}
