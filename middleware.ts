import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedEmail } from '@/lib/security/allowed-email';

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

  if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/auth/callback') {
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
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

  // getClaims verifies the access token rather than trusting cookie session data.
  const { data, error } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === 'string' ? data.claims.email : undefined;

  if (error || !email) {
    return redirectToLogin(request, response);
  }

  if (!process.env.ALLOWED_EMAIL || !isAllowedEmail(email, process.env.ALLOWED_EMAIL)) {
    await supabase.auth.signOut();
    return redirectToLogin(request, response, 'unauthorized');
  }

  return response;
}

export const config = {
  matcher: ['/((?!login(?:/|$)|auth/callback(?:/|$)|_next/static|_next/image|favicon.ico).*)'],
};
