'use client';

import React, { FormEvent, useState } from 'react';

import type { SafeAllowedUser } from '@/lib/access/member-management';

type UserManagementPanelProps = { initialUsers: SafeAllowedUser[] };

async function responseMessage(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? fallback;
}

export function UserManagementPanel({ initialUsers }: UserManagementPanelProps) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, 'Kullanıcı eklenemedi.'));
      const member = await response.json() as SafeAllowedUser;
      setUsers((current) => [...current.filter((user) => user.id !== member.id), member]
        .sort((left, right) => (left.created_at ?? '').localeCompare(right.created_at ?? '')));
      setEmail('');
      setMessage('Kullanıcı erişime eklendi.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Kullanıcı eklenemedi.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(user: SafeAllowedUser, status: 'active' | 'revoked') {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error(await responseMessage(response, 'Erişim güncellenemedi.'));
      const updated = await response.json() as SafeAllowedUser;
      setUsers((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setMessage(status === 'active' ? 'Erişim yeniden açıldı.' : 'Erişim kapatıldı.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erişim güncellenemedi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addMember}>
        <label className="sr-only" htmlFor="member-email">E-posta</label>
        <input
          autoComplete="email"
          className="min-h-11 flex-1 rounded-md border border-slate-300 px-3 text-sm"
          id="member-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-posta"
          required
          type="email"
          value={email}
        />
        <button className="calendar-control bg-sky-700 text-white hover:bg-sky-800 disabled:bg-sky-400" disabled={busy} type="submit">Ekle</button>
      </form>
      {message ? <p aria-live="polite" className="mt-3 text-sm text-slate-700">{message}</p> : null}
      <ul className="mt-4 divide-y divide-slate-200" aria-label="İzinli kullanıcılar">
        {users.map((user) => (
          <li className="flex flex-wrap items-center gap-3 py-3" key={user.id}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.email}</p>
              <p className="text-xs text-slate-500">{user.role === 'owner' ? 'Sahip' : user.status === 'active' ? 'Erişim açık' : 'Erişim kapalı'}</p>
            </div>
            {user.role === 'member' ? (
              <button
                aria-label={user.status === 'active' ? `${user.email} erişimini kapat` : `${user.email} erişimini aç`}
                className="calendar-control"
                data-testid={`${user.id}-${user.status === 'active' ? 'revoke' : 'restore'}`}
                disabled={busy}
                onClick={() => updateStatus(user, user.status === 'active' ? 'revoked' : 'active')}
                type="button"
              >
                {user.status === 'active' ? 'Erişimi kapat' : 'Erişimi aç'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
