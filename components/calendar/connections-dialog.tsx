'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import type { ProviderConnection } from '@/lib/providers/types';

type ConnectionSource = {
  id: string;
  connectionId: string;
  name: string;
  color: string | null;
  isSelected: boolean;
};

type ConnectionsDialogProps = { open: boolean; onClose: () => void; onSourceSelectionChange: (sourceId: string, isSelected: boolean) => void };

function connectionState(connection: ProviderConnection): string | null {
  if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt).getTime() <= Date.now()) return 'İznin süresi dolmuş. Yeniden bağlanın.';
  if (!connection.isActive) return 'Bağlantı etkin değil. Yeniden bağlanın.';
  return null;
}

export function ConnectionsDialog({ open, onClose, onSourceSelectionChange }: ConnectionsDialogProps) {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [sources, setSources] = useState<ConnectionSource[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetch('/api/connections')
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load connections')))
      .then((data: { connections?: ProviderConnection[]; sources?: ConnectionSource[] }) => {
        if (!active) return;
        setConnections(data.connections ?? []);
        setSources(data.sources ?? []);
      })
      .catch(() => active && setMessage('Bağlantılar yüklenemedi.'));
    return () => { active = false; };
  }, [open]);

  if (!open) return null;

  async function toggleSource(source: ConnectionSource) {
    const isSelected = !source.isSelected;
    const response = await fetch(`/api/calendar-sources/${source.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ isSelected }),
    });
    if (!response.ok) {
      setMessage('Takvim seçimi kaydedilemedi.');
      return;
    }
    setSources((current) => current.map((item) => item.id === source.id ? { ...item, isSelected } : item));
    onSourceSelectionChange(source.id, isSelected);
  }

  async function removeConnection(connectionId: string) {
    const response = await fetch(`/api/connections/${connectionId}`, { method: 'DELETE' });
    if (!response.ok) {
      setMessage('Bağlantı kaldırılamadı.');
      return;
    }
    setConnections((current) => current.filter((connection) => connection.id !== connectionId));
    setSources((current) => current.filter((source) => source.connectionId !== connectionId));
    setMessage('Bağlantı kaldırıldı.');
  }

  return (
    <div aria-labelledby="connections-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" role="dialog">
      <div className="max-h-full w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold" id="connections-title">Bağlantılar</h2>
          <button aria-label="Bağlantıları kapat" className="calendar-control" onClick={onClose} type="button">Kapat</button>
        </div>
        <p className="mt-2 text-sm text-slate-600">Takvimler salt okunur bağlanır; etkinlik oluşturulmaz veya değiştirilmez.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="calendar-control" href="/api/connections/google/start">Google bağla</Link>
          <Link className="calendar-control" href="/api/connections/microsoft/start">Outlook bağla</Link>
        </div>
        <div className="mt-5 space-y-3">
          {connections.map((connection) => {
            const state = connectionState(connection);
            return (
              <section className="rounded-lg border border-slate-200 p-3" key={connection.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{connection.provider === 'google' ? 'Google Takvim' : 'Outlook Takvim'}</h3>
                    <p className="text-xs text-slate-500">{connection.providerAccountId}</p>
                  </div>
                  <button className="calendar-control" onClick={() => void removeConnection(connection.id)} type="button">Bağlantıyı kaldır</button>
                </div>
                {state ? <p className="mt-2 text-sm font-medium text-amber-800">{state}</p> : null}
                <fieldset className="mt-3 space-y-2">
                  <legend className="text-sm font-medium">Gösterilecek takvimler</legend>
                  {sources.filter((source) => source.connectionId === connection.id).map((source) => (
                    <label className="flex min-h-11 items-center gap-2 text-sm" key={source.id}>
                      <input checked={source.isSelected} onChange={() => void toggleSource(source)} type="checkbox" />
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color ?? '#64748b' }} />
                      {source.name}
                    </label>
                  ))}
                </fieldset>
              </section>
            );
          })}
        </div>
        {message ? <p aria-live="polite" className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </div>
  );
}
