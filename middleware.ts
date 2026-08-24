import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { hasActiveMembership } from '@/lib/access/active-membership';

function redirectToLogin(
  request: NextRequest,
  response: NextResponse,
  error?: 'unauthorized',
) {
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = error ? `?error=${error}` : '';

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // This is deliberately an exact route match: the cron handler performs its
  // own fail-closed bearer-token validation, while every other API route stays
  // behind session middleware.
  if (request.nextUrl.pathname === '/api/cron/sync') {
    return response;
  }

  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/auth/callback' || request.nextUrl.pathname === '/auth/verify') {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey || !serviceRoleKey) {
    return redirectToLogin(request, response);
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser checks the session with Supabase Auth; the membership lookup below
  // then enforces revocations immediately rather than waiting for JWT expiry.
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    return redirectToLogin(request, response);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const activeMembership = await hasActiveMembership({
    userId: user.id,
    findAllowedUser: async (userId) => {
      const { data: membership, error: membershipError } = await admin
        .from('allowed_users')
        .select('status')
        .eq('user_id', userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      return membership;
    },
  }).catch(() => false);

  if (!activeMembership) {
    await supabase.auth.signOut();
    return redirectToLogin(request, response, 'unauthorized');
  }

  return response;
}

export const config = {
  matcher: ['/((?!login(?:/|$)|auth/callback(?:/|$)|_next/static|_next/image|favicon.ico).*)'],
};
