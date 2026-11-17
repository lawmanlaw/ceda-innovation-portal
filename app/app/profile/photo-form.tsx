'use client';
import { useActionState, useState } from 'react';
import { setProfilePhoto } from '@/app/app/actions';
import Avatar from '@/components/avatar';

export default function PhotoForm({ id, name, v }: { id: string; name: string | null; v: number }) {
  const [state, run, busy] = useActionState(setProfilePhoto, {});
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <form action={run} className="card photo-form">
      <label className="photo-pick" title="Change photo">
        {preview ? <img className="avatar" src={preview} alt="" style={{ width: 96, height: 96 }} /> : <Avatar id={id} name={name} v={v} size={96} />}
        <span className="photo-edit" aria-hidden="true">Change</span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
      </label>
      <div className="stack" style={{ gap: '.4rem' }}>
        <strong>Profile photo</strong>
        <span className="muted" style={{ fontSize: '.88rem' }}>Optional. Only you and CEDA staff can see it. Location and phone details are removed from the photo.</span>
        {(state.ok || state.error) && <span className={state.error ? 'field-note bad' : 'field-note ok'} role="status">{state.error ?? state.ok}</span>}
        <div className="row" style={{ gap: '.5rem' }}>
          <button className="btn small" disabled={busy || !preview} aria-busy={busy}>{busy ? 'Saving...' : 'Save photo'}</button>
          {v > 0 && <button className="btn ghost small" name="remove" value="1" disabled={busy}>Remove</button>}
        </div>
      </div>
    </form>
  );
}
