'use client';
import { useActionState, useEffect, useState } from 'react';
import { decideIdea } from '@/app/app/actions';

type Choice = { to: string; label: string; tone: 'go' | 'back' | 'stop' | 'award' };
const CHOICES: Record<string, Choice[]> = {
  submitted: [{ to: 'in_review', label: 'Open review', tone: 'go' }, { to: 'rejected', label: 'Decline', tone: 'stop' }],
  in_review: [{ to: 'approved', label: 'Approve', tone: 'go' }, { to: 'feedback', label: 'Send back for changes', tone: 'back' }, { to: 'rejected', label: 'Decline', tone: 'stop' }],
  approved: [{ to: 'awarded', label: 'Award', tone: 'award' }],
};
const NOTE_LABEL: Record<string, string> = {
  feedback: 'What should the innovator change? (required)',
  rejected: 'Why is it not being taken forward? (required)',
  approved: 'Message to the innovator (optional)',
  awarded: 'Message to the innovator (optional)',
  in_review: 'Note (optional)',
};

export default function DecisionPanel({ ideaId, stage, title, ref_, ownerEmail, ownerName }: { ideaId: string; stage: string; title: string; ref_: string; ownerEmail: string | null; ownerName: string | null }) {
  const [state, run, busy] = useActionState(decideIdea, {});
  const choices = CHOICES[stage] ?? [];
  const [to, setTo] = useState(choices[0]?.to ?? '');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(true);
  const [steps, setSteps] = useState([{ t: '', d: '' }]);
  const needsWhy = to === 'feedback' || to === 'rejected';
  const withSteps = to === 'awarded' || to === 'approved';

  useEffect(() => {
    if (!state.ok || !email || !ownerEmail) return;
    const word = choices.find((c) => c.to === to)?.label ?? 'Update';
    const list = withSteps ? steps.filter((s) => s.t.trim()).map((s, i) => `${i + 1}. ${s.t}${s.d ? ` (by ${s.d})` : ''}`).join('\n') : '';
    const body = `Dumela ${ownerName ?? ''},\n\nYour idea "${title}" (${ref_}) has an update from the CEDA panel: ${word}.\n\n${note}${list ? `\n\nNext steps:\n${list}` : ''}\n\nSee the details in the CEDA Innovation Portal.\n\nCEDA Innovation Team`;
    window.location.href = `mailto:${encodeURIComponent(ownerEmail)}?subject=${encodeURIComponent(`${ref_}: ${word}`)}&body=${encodeURIComponent(body)}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!choices.length) return null;
  return (
    <form action={run} className="card stack decision">
      <h2>Decision</h2>
      <input type="hidden" name="idea_id" value={ideaId} />
      <input type="hidden" name="to" value={to} />
      <div className="decision-choices" role="radiogroup" aria-label="Decision">
        {choices.map((c) => (
          <button key={c.to} type="button" role="radio" aria-checked={to === c.to} className={`decide ${c.tone}`} onClick={() => setTo(c.to)}>{c.label}</button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="note">{NOTE_LABEL[to]}</label>
        <textarea id="note" name="note" maxLength={2000} rows={3} required={needsWhy} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {withSteps && (
        <div className="field">
          <label>Next steps for the innovator</label>
          <span className="hint">They tick these off on their idea page, so you can track progress.</span>
          {steps.map((s, i) => (
            <div key={i} className="step-row">
              <input name="step_title" placeholder={i === 0 ? 'For example: Register the business with CIPA' : 'Next step'} value={s.t} maxLength={200} onChange={(e) => setSteps(steps.map((x, k) => (k === i ? { ...x, t: e.target.value } : x)))} />
              <input name="step_due" type="date" value={s.d} aria-label="Due date" onChange={(e) => setSteps(steps.map((x, k) => (k === i ? { ...x, d: e.target.value } : x)))} />
              {steps.length > 1 && <button type="button" className="btn ghost small" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, k) => k !== i))}>Remove</button>}
            </div>
          ))}
          <button type="button" className="btn ghost small" onClick={() => setSteps([...steps, { t: '', d: '' }])}>Add a step</button>
        </div>
      )}
      <label className="row consent"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} disabled={!ownerEmail} />
        <span>Also email the innovator{ownerEmail ? '' : ' (no email on file)'}. Your email app opens with the message ready to send.</span></label>
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}
      {state.ok && <p className="notice" role="status">{state.ok}</p>}
      <button className={`btn decide-go ${choices.find((c) => c.to === to)?.tone}`} disabled={busy} aria-busy={busy}>{busy ? 'Saving...' : `Confirm: ${choices.find((c) => c.to === to)?.label}`}</button>
    </form>
  );
}
