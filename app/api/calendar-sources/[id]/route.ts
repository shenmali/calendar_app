import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

function isSourceSelection(value: unknown): value is { isSelected: boolean } {
  return typeof value === 'object' && value !== null && typeof (value as { isSelected?: unknown }).isSelected === 'boolean';
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload: unknown = await request.json().catch(() => null);
  if (!isSourceSelection(payload)) return NextResponse.json({ error: 'Expected isSelected boolean' }, { status: 400 });

  const { id } = await params;
  const { error } = await createAdminClient()
    .from('calendar_sources')
    .update({ is_selected: payload.isSelected })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: 'Unable to update calendar source' }, { status: 500 });

  return NextResponse.json({ sourceId: id, isSelected: payload.isSelected });
}
