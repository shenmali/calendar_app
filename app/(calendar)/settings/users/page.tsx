import { UserManagementPanel } from '@/components/users/user-management-panel';
import { getCurrentActiveOwner } from '@/lib/access/server-owner';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SafeAllowedUser } from '@/lib/access/member-management';

export const dynamic = 'force-dynamic';

export default async function UserManagementPage() {
  await getCurrentActiveOwner();
  const { data, error } = await createAdminClient()
    .from('allowed_users')
    .select('id, email, role, status, created_at, revoked_at')
    .order('created_at', { ascending: true });
  if (error) throw error;

  return (
    <main aria-label="Kullanıcı yönetimi" className="mx-auto max-w-3xl p-4 lg:p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Ayarlar</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Kullanıcı yönetimi</h1>
      <p className="mt-2 text-sm text-slate-600">Yalnızca erişime eklediğiniz kişiler kendi takvimlerini görüntüleyebilir.</p>
      <div className="mt-5"><UserManagementPanel initialUsers={data as SafeAllowedUser[]} /></div>
    </main>
  );
}
