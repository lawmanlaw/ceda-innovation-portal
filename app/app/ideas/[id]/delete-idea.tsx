'use client';
import { useActionState, useState } from 'react';
import { deleteIdea } from '@/app/app/actions';

export default function DeleteIdea({ ideaId, ref_ }: { ideaId: string; ref_: string }) {
  const [open, setOpen] = useState(false);
  const [state, run, busy] = useActionState(deleteIdea, {});
  if (!open) return <button type="button" className="btn danger small" onClick={() => setOpen(true)}>Delete {ref_}</button>;
  return (
    <form action={run} className="card stack delete-box">
      <input type="hidden" name="idea_id" value={ideaId} />
      <strong>Delete {ref_} for good?</strong>
      <p className="muted" style={{ margin: 0 }}>The idea, its files, scores, feedback and next steps are removed and cannot be brought back.</p>
      <div className="field"><label htmlFor="confirm-del">Type DELETE to confirm</label><input id="confirm-del" name="confirm" autoComplete="off" required /></div>
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}
      <div className="row" style={{ gap: '.5rem' }}>
        <button className="btn danger small" disabled={busy}>{busy ? 'Deleting...' : `Delete ${ref_}`}</button>
        <button type="button" className="btn ghost small" onClick={() => setOpen(false)}>Keep it</button>
      </div>
    </form>
  );
}
