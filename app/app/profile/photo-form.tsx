'use client';
import { useActionState, useState } from 'react';
import { setAvatar, setProfilePhoto } from '@/app/app/actions';
import { AVATARS, AvatarArt } from '@/components/avatar-art';
import Avatar from '@/components/avatar';

export default function PhotoForm({ id, name, v, avatar }: { id: string; name: string | null; v: number; avatar: string | null }) {
  const [pick, setPick] = useState(avatar);
  const [note, setNote] = useState<string | null>(null);
  const choose = async (a: string | null) => { setPick(a); const r = await setAvatar(a); setNote(r.error ?? r.ok ?? null); };
  const [state, run, busy] = useActionState(setProfilePhoto, {});
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <form action={run} className="card photo-form">
      <label className="photo-pick" title="Change photo">
        {preview ? <img className="avatar" src={preview} alt="" style={{ width: 96, height: 96 }} /> : <Avatar id={id} name={name} v={v} avatar={pick} size={96} />}
        <span className="photo-edit" aria-hidden="true">Change</span>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
      </label>
      <div className="stack" style={{ gap: '.4rem' }}>
        <strong>Profile picture</strong>
        <span className="muted" style={{ fontSize: '.88rem' }}>Upload a photo, or pick an avatar. Photos are seen only by you and CEDA staff, with location and phone details removed.</span>
        <div className="avatar-grid" role="radiogroup" aria-label="Avatars">
          {Object.entries(AVATARS).map(([k, a]) => (
            <button key={k} type="button" role="radio" aria-checked={pick === k} aria-label={a.label} title={a.label} className="avatar-choice" onClick={() => choose(pick === k ? null : k)}><AvatarArt name={k} size={44} /></button>
          ))}
        </div>
        {note && <span className="field-note ok" role="status">{note}{v > 0 ? ' Your photo shows first; remove it to use the avatar.' : ''}</span>}
        {(state.ok || state.error) && <span className={state.error ? 'field-note bad' : 'field-note ok'} role="status">{state.error ?? state.ok}</span>}
        <div className="row" style={{ gap: '.5rem' }}>
          <button className="btn small" disabled={busy || !preview} aria-busy={busy}>{busy ? 'Saving...' : 'Save photo'}</button>
          {v > 0 && <button className="btn ghost small" name="remove" value="1" disabled={busy}>Remove</button>}
        </div>
      </div>
    </form>
  );
}
