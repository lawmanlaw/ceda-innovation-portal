import Link from 'next/link';
import Icon from '@/components/icon';
import { notFound, redirect } from 'next/navigation';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { StageLabel, StageTrack } from '@/components/stage';
import ActionForm from '@/components/action-form';
import Uploader from '@/components/uploader';
import { STAGE_LABEL, type Idea, type Stage, type FormField } from '@/lib/types';
import { fmtDate } from '@/lib/util';
import {
  assignEvaluator, moveIdea, postFeedback, removeAttachment, saveScores, unassignEvaluator, withdrawIdea,
} from '@/app/app/actions';

const SCORE_WORDS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export const metadata = { title: 'Idea' };

const DECISIONS: Partial<Record<Stage, { to: Stage; label: string }[]>> = {
  submitted: [{ to: 'in_review', label: 'Start review' }, { to: 'rejected', label: 'Decline' }],
  in_review: [{ to: 'approved', label: 'Approve' }, { to: 'feedback', label: 'Return with feedback' }, { to: 'rejected', label: 'Decline' }],
  approved: [{ to: 'awarded', label: 'Mark as awarded' }],
};

export default async function IdeaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMe();
  const sb = await supabaseServer();

  const { data: ideaRow } = await sb.from('ideas').select('*').eq('id', id).maybeSingle();
  if (!ideaRow) notFound();
  const idea = ideaRow as Idea;
  if (idea.stage === 'draft') redirect(`/app/ideas/new?draft=${id}`);
  const isOwner = idea.owner_id === me.id;
  const isPanel = me.role === 'admin' || me.role === 'adjudicator';

  const [{ data: fields }, { data: category }, { data: history }, { data: feedback }, { data: files }, { data: myAssignment }] = await Promise.all([
    sb.from('form_fields').select('key, label, sort').order('sort'),
    idea.category_id ? sb.from('categories').select('name').eq('id', idea.category_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('stage_history').select('id, from_stage, to_stage, note, created_at').eq('idea_id', id).order('created_at'),
    sb.from('feedback').select('id, author_id, body, internal, created_at').eq('idea_id', id).order('created_at'),
    sb.from('attachments').select('id, file_name, storage_path, size_bytes, created_at').eq('idea_id', id).order('created_at'),
    sb.from('assignments').select('submitted_at').eq('idea_id', id).eq('evaluator_id', me.id).maybeSingle(),
  ]);


  // Panel-only data
  let panel: null | {
    owner: { full_name: string; email: string | null; organisation: string | null } | null;
    assigned: { evaluator_id: string; submitted_at: string | null; name: string }[];
    evaluators: { id: string; full_name: string }[];
    results: { criterion: string; weight: number; max_score: number; average: number | null; evaluators: number }[];
    pct: number | null;
  } = null;
  if (isPanel) {
    const [{ data: owner }, { data: assigned }, { data: evaluators }, { data: results }, { data: pct }] = await Promise.all([
      sb.from('profiles').select('full_name, email, organisation').eq('id', idea.owner_id).maybeSingle(),
      sb.from('assignments').select('evaluator_id, submitted_at').eq('idea_id', id),
      sb.from('profiles').select('id, full_name').eq('role', 'evaluator').order('full_name'),
      sb.rpc('idea_results', { p_idea: id }),
      sb.rpc('idea_score_pct', { p_idea: id }),
    ]);
    const names = new Map((evaluators ?? []).map((e) => [e.id, e.full_name]));
    panel = {
      owner,
      assigned: (assigned ?? []).map((a) => ({ ...a, name: names.get(a.evaluator_id) ?? 'Evaluator' })),
      evaluators: (evaluators ?? []).filter((e) => !(assigned ?? []).some((a) => a.evaluator_id === e.id)),
      results: results ?? [],
      pct: pct as number | null,
    };
  }

  // Evaluator scoring
  const canScore = me.role === 'evaluator' && !!myAssignment && !myAssignment.submitted_at && idea.stage === 'in_review';
  let criteria: { id: string; name: string; description: string | null; max_score: number; weight: number }[] = [];
  let myScores = new Map<string, { score: number; comment: string | null }>();
  if (me.role === 'evaluator' && myAssignment) {
    const [{ data: c }, { data: s }] = await Promise.all([
      sb.from('criteria').select('id, name, description, max_score, weight').eq('active', true).order('sort'),
      sb.from('scores').select('criterion_id, score, comment').eq('idea_id', id).eq('evaluator_id', me.id),
    ]);
    criteria = c ?? [];
    myScores = new Map((s ?? []).map((x) => [x.criterion_id, x]));
  }

  const reached = (history ?? []).map((h) => h.to_stage as Stage);
  const editable = isOwner && idea.stage === 'feedback';
  const canTalk = !['withdrawn', 'rejected', 'awarded'].includes(idea.stage);

  return (
    <div className="stack">
      <p><Link href={isPanel ? '/app/ideas' : '/app'}>Back</Link></p>
      {isNew && <p className="notice row" role="status" style={{ flexWrap: 'nowrap' }}><Icon name="bulb" />Your idea has been submitted as {idea.ref}. We have sent you an alert and will tell you as soon as review starts.</p>}

      <div className="row between">
        <div>
          <h1 style={{ marginBottom: '.25rem' }}>{idea.title}</h1>
          <p className="muted" style={{ margin: 0 }}>{idea.ref} · version {idea.version} · submitted {fmtDate(idea.submitted_at)}</p>
        </div>
        <StageLabel stage={idea.stage} />
      </div>
      <StageTrack stage={idea.stage} reached={reached} />

      {isOwner && idea.stage === 'feedback' && (
        <div className="notice row between">
          <span>The panel asked for changes. Read their feedback below, then update your idea.</span>
          <Link className="btn small" href={`/app/ideas/${id}/edit`}>Edit and resubmit</Link>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="stack">
          <section className="card">
            <h2>Summary</h2>
            <p>{idea.summary}</p>
            <p className="muted">{category?.name ?? 'Uncategorised'} · {idea.district}</p>
            {(fields as Pick<FormField, 'key' | 'label'>[] | null)?.filter((f) => idea.answers[f.key]).map((f) => (
              <div key={f.key} style={{ marginTop: '1rem' }}>
                <h3>{f.label}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{idea.answers[f.key]}</p>
              </div>
            ))}
          </section>

          <section className="card">
            <h2>Supporting files</h2>
            {!files?.length && <p className="muted">No files attached.</p>}
            <ul style={{ paddingLeft: '1.1rem' }}>
              {files?.map((f) => (
                <li key={f.id} className="row between">
                  <a href={`/app/files/${f.id}`} download>{f.file_name}</a>
                  <span className="row">
                    <small>{Math.ceil(f.size_bytes / 1024)} KB</small>
                    {editable && (
                      <form action={removeAttachment}>
                        <input type="hidden" name="attachment_id" value={f.id} />
                        <button className="btn danger small">Remove</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {editable && <Uploader ideaId={id} />}
          </section>

          {canScore || (me.role === 'evaluator' && myAssignment) ? (
            <section className="card">
              <h2>Your evaluation</h2>
              {myAssignment?.submitted_at && <p className="muted">You submitted your scores on {fmtDate(myAssignment.submitted_at)}.</p>}
              {!canScore && !myAssignment?.submitted_at && <p className="muted">Scoring opens when this idea is in review.</p>}
              {canScore && (
                <ActionForm action={saveScores} submit="Save draft" extra={
                  <button className="btn secondary" name="final" value="1">Submit final scores</button>
                }>
                  <input type="hidden" name="idea_id" value={id} />
                  {criteria.map((c) => (
                    <fieldset key={c.id} className="score-row">
                      <legend>{c.name}</legend>
                      {c.description && <span className="hint">{c.description}</span>}
                      <div className="score-scale" role="radiogroup" aria-label={`${c.name}, 1 Poor to ${c.max_score} Excellent`}>
                        {Array.from({ length: c.max_score }, (_, k) => k + 1).map((n) => (
                          <label key={n} className="score-pick">
                            <input type="radio" name={`score_${c.id}`} value={n} defaultChecked={myScores.get(c.id)?.score === n} />
                            <span>{n}</span>
                            <small>{SCORE_WORDS[n - 1] ?? ''}</small>
                          </label>
                        ))}
                      </div>
                      <textarea name={`comment_${c.id}`} maxLength={1000} rows={2} placeholder="Comment for the panel (optional)" aria-label={`${c.name} comment`} defaultValue={myScores.get(c.id)?.comment ?? ''} />
                    </fieldset>
                  ))}
                </ActionForm>
              )}
            </section>
          ) : null}

          <section className="card">
            <h2>Conversation</h2>
            {!feedback?.length && <p className="muted">No messages yet.</p>}
            {feedback?.map((f) => (
              <div key={f.id} style={{ padding: '.75rem 0', borderTop: '1px solid var(--line)' }}>
                <p style={{ margin: 0 }}>
                  <strong>{f.author_id === idea.owner_id ? (isOwner ? 'You' : 'Submitter') : f.author_id === me.id ? 'You' : 'CEDA panel'}</strong>
                  {f.internal && <span className="muted"> · internal note, not visible to the submitter</span>}
                  <small style={{ marginLeft: '.5rem' }}>{fmtDate(f.created_at, true)}</small>
                </p>
                <p style={{ whiteSpace: 'pre-wrap', margin: '.25rem 0 0' }}>{f.body}</p>
              </div>
            ))}
            {canTalk && me.role !== 'observer' && (
              <ActionForm action={postFeedback} submit={isOwner ? 'Send reply' : 'Post'} reset className="stack" extra={
                !isOwner && me.role !== 'submitter' ? (
                  <label className="row" style={{ fontWeight: 400, margin: 0 }}>
                    <input type="checkbox" name="internal" value="1" /> Internal note
                  </label>
                ) : null
              }>
                <input type="hidden" name="idea_id" value={id} />
                <label htmlFor="body" className="hint" style={{ marginTop: '1rem' }}>{isOwner ? 'Reply to the panel' : 'Feedback for the submitter'}</label>
                <textarea id="body" name="body" required maxLength={4000} style={{ minHeight: 90 }} />
              </ActionForm>
            )}
          </section>
        </div>

        <aside className="stack">
          {panel && (
            <>
              <section className="card">
                <h2>Submitter</h2>
                <p style={{ margin: 0 }}>{panel.owner?.full_name}</p>
                <p className="muted" style={{ margin: 0 }}>{panel.owner?.organisation}</p>
                <p className="muted">{panel.owner?.email}</p>
              </section>

              <section className="card">
                <h2>Evaluators</h2>
                {!panel.assigned.length && <p className="muted">None assigned yet.</p>}
                {panel.assigned.map((a) => (
                  <div key={a.evaluator_id} className="row between" style={{ padding: '.25rem 0' }}>
                    <span>{a.name}<br /><small>{a.submitted_at ? `Scored ${fmtDate(a.submitted_at)}` : 'Not scored yet'}</small></span>
                    {['submitted', 'in_review'].includes(idea.stage) && (
                      <form action={unassignEvaluator}>
                        <input type="hidden" name="idea_id" value={id} />
                        <input type="hidden" name="evaluator_id" value={a.evaluator_id} />
                        <button className="btn danger small">Remove</button>
                      </form>
                    )}
                  </div>
                ))}
                {['submitted', 'in_review'].includes(idea.stage) && panel.evaluators.length > 0 && (
                  <ActionForm action={assignEvaluator} submit="Assign">
                    <input type="hidden" name="idea_id" value={id} />
                    <select name="evaluator_id" aria-label="Evaluator" required defaultValue="">
                      <option value="" disabled>Choose an evaluator</option>
                      {panel.evaluators.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </ActionForm>
                )}
              </section>

              <section className="card">
                <h2>Scores</h2>
                {panel.pct !== null ? <p className="stat"><strong>{panel.pct}%</strong><span>weighted average</span></p> : <p className="muted">No scores yet.</p>}
                <table>
                  <tbody>
                    {panel.results.map((r) => (
                      <tr key={r.criterion}>
                        <td>{r.criterion}<br /><small>weight {r.weight}</small></td>
                        <td style={{ textAlign: 'right' }}>{r.average ?? '-'} / {r.max_score}<br /><small>{r.evaluators} scored</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {DECISIONS[idea.stage] && (
                <section className="card">
                  <h2>Decision</h2>
                  <ActionForm action={moveIdea} submit="Confirm">
                    <input type="hidden" name="idea_id" value={id} />
                    {DECISIONS[idea.stage]!.map((d, i) => (
                      <label key={d.to} className="row" style={{ fontWeight: 400, margin: 0 }}>
                        <input type="radio" name="to" value={d.to} required defaultChecked={i === 0} /> {d.label}
                      </label>
                    ))}
                    <label htmlFor="note" className="hint">Note to the submitter (required when returning or declining)</label>
                    <textarea id="note" name="note" maxLength={2000} style={{ minHeight: 80 }} />
                  </ActionForm>
                </section>
              )}
            </>
          )}

          <section className="card">
            <h2>History</h2>
            <ol className="timeline">
              {history?.map((h) => (
                <li key={h.id}>
                  <strong>{STAGE_LABEL[h.to_stage as Stage]}</strong> <small>{fmtDate(h.created_at, true)}</small>
                  {h.note && <div className="muted" style={{ fontSize: '.92rem' }}>{h.note}</div>}
                </li>
              ))}
            </ol>
          </section>

          {isOwner && !['draft', 'approved', 'awarded', 'rejected', 'withdrawn'].includes(idea.stage) && (
            <form action={withdrawIdea}>
              <input type="hidden" name="idea_id" value={id} />
              <button className="btn danger small">Withdraw {idea.ref}</button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
