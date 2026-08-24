import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { handleAuthCallback } from '@/lib/auth/callback';
import { normalizeEmail } from '@/lib/access/allowed-users';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const verificationSchema = z.object({
  email: z.string().trim().email().max(320),
  token: z.string().trim().regex(/^\d{8}$/),
});

const invalidCodeMessage = 'Kod doğrulanamadı. Lütfen yeni bir kod isteyin.';

export async function POST(request: NextRequest) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = verificationSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: invalidCodeMessage }, { status: 400 });

  const email = normalizeEmail(parsed.data.email);
  const supabase = await createClient();
  const { data, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.token,
    type: 'email',
  });

  if (verifyError || !data.user) {
    return NextResponse.json({ error: invalidCodeMessage }, { status: 401 });
  }

  const completion = await handleAuthCallback({
    userId: data.user.id,
    email: data.user.email,
    origin: request.nextUrl.origin,
    signOut: async () => {
      await supabase.auth.signOut();
    },
    upsertProfile: async (profile) => {
      const { error } = await createAdminClient()
        .from('profiles')
        .upsert(profile, { onConflict: 'id' });
      if (error) throw error;
    },
    findActiveAllowedUser: async ({ userId, email: userEmail }) => {
      const { data: membership, error } = await createAdminClient()
        .from('allowed_users')
        .select('id')
        .eq('user_id', userId)
        .eq('email', normalizeEmail(userEmail))
        .eq('status', 'active')
        .maybeSingle();
      if (error) throw error;
      return Boolean(membership);
    },
  });

  const destination = new URL(completion.headers.get('location') ?? '/login?error=auth_callback', request.url);
  if (destination.pathname === '/' && destination.search === '') {
    return NextResponse.json({ ok: true });
  }

  const unauthorized = destination.searchParams.get('error') === 'unauthorized';
  return NextResponse.json(
    { error: unauthorized ? 'Bu hesap takvime erişemez.' : invalidCodeMessage },
    { status: unauthorized ? 403 : 500 },
  );
}
