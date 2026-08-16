import { LoginForm } from '@/components/auth/login-form';

const errorMessages = {
  auth_callback: 'Giriş bağlantısı doğrulanamadı. Lütfen yeni bir bağlantı isteyin.',
  unauthorized: 'Bu hesap takvime erişemez.',
};

type LoginPageProps = {
  searchParams: Promise<{ error?: keyof typeof errorMessages }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <section className="w-full rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Takvime giriş</h1>
        <p className="mt-2 text-sm text-slate-600">Erişim bağlantısını almak için izinli e-posta adresinizi girin.</p>
        {error ? <p className="mt-4 text-sm text-red-700">{errorMessages[error]}</p> : null}
        <LoginForm />
      </section>
    </main>
  );
}
