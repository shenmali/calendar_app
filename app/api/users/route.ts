import { NextResponse } from 'next/server';
import { z } from 'zod';

import { addOrRestoreMember, MemberManagementError, type SafeAllowedUser } from '@/lib/access/member-management';
import { AccessError, getCurrentActiveOwner } from '@/lib/access/server-owner';
import { normalizeEmail } from '@/lib/access/allowed-users';
import { createAdminClient } from '@/lib/supabase/admin';

const safeUserFields = 'id, email, role, status, created_at, revoked_at';
const addMemberSchema = z.object({ email: z.string().trim().email().max(320) });

function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const match = data.users.find((candidate) => normalizeEmail(candidate.email ?? '') === email);
    if (match) return { id: match.id };
    if (data.users.length < 1000) return null;
  }
}

export async function GET() {
  try {
    await getCurrentActiveOwner();
    const { data, error } = await createAdminClient()
      .from('allowed_users')
      .select(safeUserFields)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ users: data satisfies SafeAllowedUser[] });
  } catch (error) {
    return accessErrorResponse(error) ?? NextResponse.json({ error: 'Unable to list users.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = addMemberSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });

  try {
    await getCurrentActiveOwner();
    const admin = createAdminClient();
    const member = await addOrRestoreMember({
      email: parsed.data.email,
      findAuthUserByEmail,
      findExistingMembership: async (userId) => {
        const { data, error } = await admin
          .from('allowed_users')
          .select('role, status')
          .eq('user_id', userId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      createAuthUser: async (input) => {
        const { data, error } = await admin.auth.admin.createUser(input);
        if (error) throw error;
        if (!data.user) throw new Error('Member Auth user could not be provisioned.');
        return { id: data.user.id };
      },
      upsertMember: async (member) => {
        const { data, error } = await admin
          .from('allowed_users')
          .upsert({ ...member, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
          .select(safeUserFields)
          .single();
        if (error) throw error;
        return data as SafeAllowedUser;
      },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof MemberManagementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return accessErrorResponse(error) ?? NextResponse.json({ error: 'Unable to add user.' }, { status: 500 });
  }
}
