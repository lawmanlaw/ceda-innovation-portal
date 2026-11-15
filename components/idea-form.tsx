'use client';
import { useActionState } from 'react';
import type { ActionState } from '@/app/app/actions';
import type { FormField, Idea } from '@/lib/types';

type Props = {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  fields: FormField[];
  categories: { id: number; name: string }[];
  districts: string[];
  idea?: Idea;
  defaultDistrict?: string | null;
};

export default function IdeaForm({ action, fields, categories, districts, idea, defaultDistrict }: Props) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className="card stack">
      {idea && <input type="hidden" name="idea_id" value={idea.id} />}
      {state.error && <p className="notice bad" role="alert">{state.error}</p>}

      <div className="field">
        <label htmlFor="title">Title</label>
        <span className="hint">A short name for your idea.</span>
        <input id="title" name="title" required minLength={5} maxLength={150} defaultValue={idea?.title} />
      </div>
      <div className="field">
        <label htmlFor="summary">One-paragraph summary</label>
        <span className="hint">What it is and why it matters, in up to 600 characters.</span>
        <textarea id="summary" name="summary" required minLength={20} maxLength={600} defaultValue={idea?.summary} style={{ minHeight: 90 }} />
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" required defaultValue={idea?.category_id ?? ''}>
            <option value="" disabled>Choose one</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="district">District or town</label>
          <select id="district" name="district" required defaultValue={idea?.district ?? defaultDistrict ?? ''}>
            <option value="" disabled>Choose one</option>
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {fields.map((f) => {
        const id = `a_${f.key}`;
        const value = idea?.answers?.[f.key] ?? '';
        return (
          <div className="field" key={f.id}>
            <label htmlFor={id}>{f.label}{!f.required && <span className="muted"> (optional)</span>}</label>
            {f.help && <span className="hint">{f.help}</span>}
            {f.kind === 'textarea' && <textarea id={id} name={id} required={f.required} maxLength={f.max_length} defaultValue={value} />}
            {f.kind === 'select' && (
              <select id={id} name={id} required={f.required} defaultValue={value}>
                <option value="" disabled={f.required}>Choose one</option>
                {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
            {['text', 'number', 'url'].includes(f.kind) && (
              <input id={id} name={id} type={f.kind} required={f.required} maxLength={f.max_length} defaultValue={value} />
            )}
          </div>
        );
      })}

      {idea && (
        <div className="field">
          <label htmlFor="note">What did you change?</label>
          <span className="hint">Helps evaluators see what is new in this version.</span>
          <textarea id="note" name="note" maxLength={1000} style={{ minHeight: 80 }} />
        </div>
      )}

      <div className="row">
        <button className="btn" disabled={pending} aria-busy={pending}>{idea ? 'Resubmit for review' : 'Submit idea'}</button>
        <span className="muted">You can add supporting files on the next page.</span>
      </div>
    </form>
  );
}
