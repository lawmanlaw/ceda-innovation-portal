'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import Uploader from '@/components/uploader';
import Bokamoso from '@/components/bokamoso';
import { friendlyError } from '@/lib/util';
import type { FormField, Idea } from '@/lib/types';

type Props = {
  fields: FormField[];
  categories: { id: number; name: string }[];
  districts: string[];
  draft: Idea | null;
  files: { id: string; file_name: string; storage_path: string; size_bytes: number }[];
  defaultDistrict: string | null;
};

const time = (d: Date) => d.toLocaleTimeString('en-BW', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Gaborone' });

// The idea form saves itself as a draft while the innovator types.
// Submitting is final: after that only the panel can reopen it for changes.
export default function DraftForm({ fields, categories, districts, draft, files, defaultDistrict }: Props) {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [id, setId] = useState<string | null>(draft?.id ?? null);
  const [v, setV] = useState({
    title: draft?.title ?? '',
    summary: draft?.summary ?? '',
    category: draft?.category_id ? String(draft.category_id) : '',
    district: draft?.district || defaultDistrict || '',
    answers: (draft?.answers ?? {}) as Record<string, string>,
  });
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'saving' | 'saved' | 'error'; at?: Date }>({ kind: draft ? 'saved' : 'idle', at: draft ? new Date(draft.updated_at) : undefined });
  const [confirm, setConfirm] = useState(false);
  const [owns, setOwns] = useState(false);
  const [final, setFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const saving = useRef<Promise<string | null> | null>(null);
  const latest = useRef(v);
  latest.current = v;
  const idRef = useRef(id);
  idRef.current = id;

  const save = useCallback(async (): Promise<string | null> => {
    if (saving.current) await saving.current;
    const cur = latest.current;
    const hasContent = cur.title.trim() || cur.summary.trim() || Object.values(cur.answers).some((a) => a?.trim());
    if (!idRef.current && !hasContent) return null;
    const run = (async () => {
      setStatus({ kind: 'saving' });
      const { data, error } = await sb.rpc('save_draft', {
        p_idea: idRef.current, p_title: cur.title, p_summary: cur.summary,
        p_category: cur.category ? Number(cur.category) : null, p_district: cur.district, p_answers: cur.answers,
      });
      if (error) { setStatus({ kind: 'error' }); setErr(friendlyError(error)); return null; }
      const newId = data as string;
      if (!idRef.current) {
        idRef.current = newId;
        setId(newId);
        router.replace(`/app/ideas/new?draft=${newId}`, { scroll: false });
      }
      setStatus({ kind: 'saved', at: new Date() });
      setDirty(false);
      return newId;
    })();
    saving.current = run;
    const out = await run;
    saving.current = null;
    return out;
  }, [sb, router]);

  // Save 1.5 seconds after the last keystroke, and when the page is hidden
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 1500);
    return () => clearTimeout(t);
  }, [v, dirty, save]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && dirty) save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [dirty, save]);

  const set = (patch: Partial<typeof v>) => { setV((p) => ({ ...p, ...patch })); setDirty(true); setErr(null); };
  const setAnswer = (k: string, val: string) => set({ answers: { ...v.answers, [k]: val } });

  async function submit() {
    setBusy(true);
    setErr(null);
    const ideaId = (await save()) ?? idRef.current;
    if (!ideaId) { setBusy(false); setConfirm(false); return setErr('Give your idea a title first.'); }
    const { error } = await sb.rpc('submit_draft', { p_idea: ideaId, p_ip_confirmed: owns && final });
    if (error) { setBusy(false); setConfirm(false); return setErr(friendlyError(error)); }
    router.replace(`/app/ideas/${ideaId}?new=1`);
    router.refresh();
  }

  async function discard() {
    if (!idRef.current) return router.replace('/app');
    setBusy(true);
    if (files.length) await sb.storage.from('idea-files').remove(files.map((f) => f.storage_path));
    await sb.rpc('delete_draft', { p_idea: idRef.current });
    router.replace('/app');
    router.refresh();
  }

  async function removeFile(f: Props['files'][number]) {
    await sb.storage.from('idea-files').remove([f.storage_path]);
    await sb.from('attachments').delete().eq('id', f.id);
    router.refresh();
  }

  // Pre-submit checklist: what must be done, and what is recommended
  const missing = fields.filter((f) => f.required && !(v.answers[f.key] ?? '').trim());
  const checks: { label: string; ok: boolean; target: string; required: boolean }[] = [
    { label: 'Title of at least 5 characters', ok: v.title.trim().length >= 5, target: 'title', required: true },
    { label: 'Summary of 20 to 600 characters', ok: v.summary.trim().length >= 20, target: 'summary', required: true },
    { label: 'Category and district chosen', ok: Boolean(v.category && v.district), target: v.category ? 'district' : 'category', required: true },
    { label: missing.length ? `${missing.length} required ${missing.length === 1 ? 'question' : 'questions'} still empty` : 'All required questions answered', ok: !missing.length, target: missing[0] ? `a_${missing[0].key}` : 'title', required: true },
    { label: files.length ? `${files.length} supporting ${files.length === 1 ? 'file' : 'files'} attached and checked` : 'No supporting files yet (recommended: a plan, pitch deck or photos)', ok: files.length > 0, target: 'files', required: false },
  ];
  const ready = checks.every((c) => c.ok || !c.required) && owns && final;
  const jump = (target: string) => { setConfirm(false); setTimeout(() => document.getElementById(target)?.focus(), 50); };

  const statusText = status.kind === 'saving' ? 'Saving...' : status.kind === 'saved' && status.at ? `Draft saved at ${time(status.at)}`
    : status.kind === 'error' ? 'Not saved. Check your connection.' : 'Your draft saves automatically as you type';

  return (
    <div className="card stack">
      <p className={`save-state ${status.kind}`} role="status" aria-live="polite">{statusText}</p>

      <div className="field">
        <label htmlFor="title">Title</label>
        <span className="hint">A short name for your idea, at least 5 characters.</span>
        <input id="title" value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={150} />
      </div>
      <div className="field">
        <label htmlFor="summary">One-paragraph summary</label>
        <span className="hint">What it is and why it matters, 20 to 600 characters.</span>
        <textarea id="summary" value={v.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={600} style={{ minHeight: 90 }} />
      </div>
      <div className="grid cols-2">
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" value={v.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Choose one</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginTop: 0 }}>
          <label htmlFor="district">District or town</label>
          <select id="district" value={v.district} onChange={(e) => set({ district: e.target.value })}>
            <option value="">Choose one</option>
            {districts.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {fields.map((f) => {
        const fid = `a_${f.key}`;
        const val = v.answers[f.key] ?? '';
        return (
          <div className="field" key={f.id}>
            <label htmlFor={fid}>{f.label}{!f.required && <span className="muted"> (optional)</span>}</label>
            {f.help && <span className="hint">{f.help}</span>}
            {f.kind === 'textarea' && <textarea id={fid} value={val} maxLength={f.max_length} onChange={(e) => setAnswer(f.key, e.target.value)} />}
            {f.kind === 'select' && (
              <select id={fid} value={val} onChange={(e) => setAnswer(f.key, e.target.value)}>
                <option value="">Choose one</option>
                {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            )}
            {['text', 'number', 'url'].includes(f.kind) && <input id={fid} type={f.kind} value={val} maxLength={f.max_length} onChange={(e) => setAnswer(f.key, e.target.value)} />}
          </div>
        );
      })}

      <div className="field" id="files" tabIndex={-1}>
        <label>Supporting files</label>
        {!id && <span className="hint">Start typing above and you can attach files once your draft is saved.</span>}
        {files.map((f) => (
          <div key={f.id} className="row between">
            <span>{f.file_name} <small>{Math.ceil(f.size_bytes / 1024)} KB</small></span>
            <button type="button" className="btn danger small" onClick={() => removeFile(f)}>Remove</button>
          </div>
        ))}
        {id && <Uploader ideaId={id} />}
      </div>

      {err && <p className="notice bad" role="alert">{err}</p>}

      {confirm ? (
        <section className="checklist" aria-labelledby="checklist-title">
          <div className="bk-auth">
            <Bokamoso mode={ready ? 'yes' : 'watch'} size={76} />
            <div>
              <h2 id="checklist-title">Before you send</h2>
              <p>{ready ? 'Everything is in place. You are ready to submit.' : "Let's check everything together. Once submitted, your idea is final unless the panel returns it for changes."}</p>
            </div>
          </div>
          <ul>
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'ok' : c.required ? 'todo' : 'warn'}>
                <span className="mark" aria-hidden="true">{c.ok ? '\u2713' : c.required ? '\u2715' : '!'}</span>
                <span>{c.label}</span>
                {!c.ok && <button type="button" className="btn ghost small" onClick={() => jump(c.target)}>Fix</button>}
              </li>
            ))}
          </ul>
          <label className="row consent"><input type="checkbox" checked={owns} onChange={(e) => setOwns(e.target.checked)} />
            <span>This idea is my own, or I am submitting it with my team&apos;s permission, and I have the right to share the files attached.</span></label>
          <label className="row consent"><input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} />
            <span>The information is accurate, and I understand that submitting is final.</span></label>
          <div className="row">
            <button className="btn" onClick={submit} disabled={busy || !ready} aria-busy={busy}>Submit idea</button>
            <button className="btn ghost" onClick={() => setConfirm(false)} disabled={busy}>Keep editing</button>
          </div>
        </section>
      ) : (
        <div className="row between">
          <button className="btn" onClick={() => { save(); setConfirm(true); }} disabled={busy}>Review and submit</button>
          {id && <button type="button" className="btn danger small" onClick={discard} disabled={busy}>Delete draft</button>}
        </div>
      )}
    </div>
  );
}
