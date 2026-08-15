'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isAllowedEmail } from '@/lib/security/allowed-email';
import { createClient } from '@/lib/supabase/browser';

type LoginFormProps = {
  allowedEmail: string;
};

export function LoginForm({ allowedEmail }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!allowedEmail || !isAllowedEmail(normalizedEmail, allowedEmail)) {
      setMessage('Bu e-posta adresinin erişim izni yok.');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    const { error } = await createClient().auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: new URL('/auth/callback', window.location.origin).toString(),
      },
    });

    setIsSubmitting(false);
    setMessage(
      error
        ? 'Giriş bağlantısı gönderilemedi. Lütfen yeniden deneyin.'
        : 'Giriş bağlantısı e-posta adresinize gönderildi.',
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium" htmlFor="email">
        E-posta adresi
      </label>
      <input
        autoComplete="email"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"
        id="email"
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        value={email}
      />
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Gönderiliyor…' : 'Magic link gönder'}
      </Button>
      {message ? <p aria-live="polite" className="text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
