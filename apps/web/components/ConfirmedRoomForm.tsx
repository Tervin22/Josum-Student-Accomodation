'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, compactForm } from '@/lib/api';
import type { Residence, RoomType } from '@/lib/types';
import { useToast } from './ToastProvider';

export function ConfirmedRoomForm({ residence, onCreated }: { residence: Residence; onCreated: () => Promise<void> }) {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  useEffect(() => {
    api<RoomType[]>(`/room-types?residenceId=${residence.id}`).then(setTypes).catch(() => setError('Room categories could not be loaded. Refresh to retry.'));
  }, [residence.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError('');
    try {
      await api('/residence-rooms', { method: 'POST', body: JSON.stringify(compactForm(new FormData(form))) });
      form.reset();
      toast.success(`Room added to ${residence.name}`);
      await onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add room');
    } finally {
      setSaving(false);
    }
  }

  if (residence.active === false || !residence.slug) return null;
  return <form onSubmit={submit} className="mt-4 border-t border-line pt-4">
    <input type="hidden" name="residenceId" value={residence.id} />
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Room number
        <input name="roomNumber" type="number" min="1" max="100000" required className="focus-ring h-10 min-w-0 rounded-md border border-line px-3" />
      </label>
      <label className="grid gap-1 text-sm">Room category
        <select name="roomTypeId" required className="focus-ring h-10 min-w-0 rounded-md border border-line bg-white px-2">
          {!types.length && <option value="">No categories</option>}
          {types.map(type => <option key={type.id} value={type.id}>{type.displayName ?? type.roomTypeName}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Gender allocation
        <select name="genderAllocation" required className="focus-ring h-10 min-w-0 rounded-md border border-line bg-white px-2">
          {(residence.allowedGenders ?? []).map(gender => <option key={gender} value={gender}>{gender}</option>)}
        </select>
      </label>
      <button disabled={saving || !types.length} className="focus-ring mt-auto flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50">
        <Plus className="h-4 w-4" />{saving ? 'Adding...' : 'Add confirmed room'}
      </button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </form>;
}
