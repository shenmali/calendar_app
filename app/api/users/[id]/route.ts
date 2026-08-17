import { NextResponse } from 'next/server';
import { z } from 'zod';

import { type SafeAllowedUser, changeMemberStatus } from '@/lib/access/member-management';
import { AccessError, getCurrentActiveOwner } from '@/lib/access/server-owner';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };
const safeUserFields = 'id, email, role, status, created_at, revoked_at';
const statusSchema = z.object({ status: z.enum(['active', 'revoked']) });

function accessErrorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const payload: unknown = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: 'Expected active or revoked status.' }, { status: 400 });

  try {
    const { userId: currentOwnerUserId } = await getCurrentActiveOwner();
    const { id } = await params;
    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from('allowed_users')
      .select('id, user_id, role, status')
      .eq('id', id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const user = await changeMemberStatus({
      currentOwnerUserId,
      target,
      status: parsed.data.status,
      updateStatus: async (targetId, status) => {
        const now = new Date().toISOString();
        const { data, error } = await admin
          .from('allowed_users')
          .update({ status, revoked_at: status === 'revoked' ? now : null, updated_at: now })
          .eq('id', targetId)
          .select(safeUserFields)
          .single();
        if (error) throw error;
        return data as SafeAllowedUser;
      },
      setAuthenticationAccess: async (userId, status) => {
        const { error } = await admin.auth.admin.updateUserById(userId, {
          ban_duration: status === 'revoked' ? '876000h' : 'none',
        });
        if (error) throw error;
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'Owners cannot be revoked.') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return accessErrorResponse(error) ?? NextResponse.json({ error: 'Unable to update user.' }, { status: 500 });
  }
}
