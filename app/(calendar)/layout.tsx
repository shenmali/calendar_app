import type { ReactNode } from 'react';
import { getCurrentActiveOwner } from '@/lib/access/server-owner';

export default async function CalendarLayout({ children }: Readonly<{ children: ReactNode }>) {
  let isOwner = false;
  try {
    await getCurrentActiveOwner();
    isOwner = true;
  } catch {
    // Members remain allowed to use the calendar; they simply do not get owner navigation.
  }

  return (
    <div className="min-h-screen">
      {isOwner ? <nav aria-label="Sahip ayarları" className="mx-auto max-w-[1600px] px-4 pt-4 lg:px-6"><a className="text-sm font-medium text-sky-700 underline underline-offset-4" href="/settings/users">Kullanıcılar</a></nav> : null}
      {children}
    </div>
  );
}
