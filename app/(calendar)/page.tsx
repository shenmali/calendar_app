import { appName } from '@/lib/app-config';

export default function CalendarPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl items-center justify-center p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{appName}</h1>
    </main>
  );
}
