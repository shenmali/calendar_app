'use client';

import React, { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

import { createEmailOtpOptions } from '@/lib/auth/email-otp';
import { createClient } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim();

    setIsSubmitting(true);
    setMessage(null);

    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: createEmailOtpOptions(),
      });

      if (error) {
        setMessage('Doğrulama kodu gönderilemedi. Lütfen yeniden deneyin.');
        return;
      }

      setStep('code');
      setMessage('E-postanıza gönderilen 6 haneli kodu girin.');
    } catch {
      setMessage('Doğrulama kodu gönderilemedi. Lütfen yeniden deneyin.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/auth/verify', {
        body: JSON.stringify({ email: email.trim(), token: token.trim() }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      const result = await response.json().catch(() => null) as { error?: string; ok?: boolean } | null;

      if (!response.ok || result?.ok !== true) {
        setMessage(result?.error ?? 'Kod doğrulanamadı. Lütfen yeni bir kod isteyin.');
        return;
      }

      router.replace('/');
    } catch {
      setMessage('Kod doğrulanamadı. Lütfen yeni bir kod isteyin.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={step === 'email' ? requestCode : verifyCode}>
      {step === 'email' ? (
        <>
          <label className="block text-sm font-medium" htmlFor="email">E-posta adresi</label>
          <input autoComplete="email" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" id="email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          <Button className="w-full" disabled={isSubmitting} type="submit">{isSubmitting ? 'Gönderiliyor…' : 'Kod gönder'}</Button>
        </>
      ) : (
        <>
          <label className="block text-sm font-medium" htmlFor="token">Doğrulama kodu</label>
          <input autoComplete="one-time-code" className="w-full rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em]" id="token" inputMode="numeric" maxLength={6} name="token" onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))} pattern="[0-9]{6}" required value={token} />
          <Button className="w-full" disabled={isSubmitting || token.length !== 6} type="submit">{isSubmitting ? 'Doğrulanıyor…' : 'Kodu doğrula'}</Button>
          <button className="w-full text-sm font-medium text-sky-700 hover:underline" onClick={() => { setStep('email'); setToken(''); setMessage(null); }} type="button">Farklı e-posta kullan</button>
        </>
      )}
      {message ? <p aria-live="polite" className="text-sm text-slate-700">{message}</p> : null}
    </form>
  );
}
