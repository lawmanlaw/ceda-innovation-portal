import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { StageLabel, StageTrack } from '@/components/stage';
import type { Idea } from '@/lib/types';
import { fmtDate } from '@/lib/util';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const me = await requireMe();
  if (me.role === 'agent') redirect('/app/agent');
  const sb = await supabaseServer();

  if (me.role === 'submitter') {
    const { data } = await sb.from('ideas').select('*').eq('owner_id', me.id).order('updated_at', { ascending: false });
    const ideas = (data ?? []) as Idea[];
    return (
      <div className="stack">
        <div className="row between">
          <h1>Welcome{me.full_name ? `, ${me.full_name.split(' ')[0]}` : ''}</h1>
          <Link className="btn" href="/app/ideas/new">Submit an idea</Link>
        </div>
        {ideas.length === 0 && (
          <div className="card">
            <h2>No ideas yet</h2>
            <p className="muted">Submitting takes about 10 minutes. You can save your thinking in a document first and paste it in.</p>
            <Link className="btn" href="/app/ideas/new">Start your first idea</Link>
          </div>
        )}
        {ideas.map((i) => (
          <Link key={i.id} href={`/app/ideas/${i.id}`} className="card" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
            <div className="row between">
              <h2 style={{ margin: 0 }}>{i.title}</h2>
              <StageLabel stage={i.stage} />
            </div>
            <p className="muted" style={{ margin: '.25rem 0 .5rem' }}>{i.ref} · submitted {fmtDate(i.submitted_at)}{i.version > 1 ? ` · version ${i.version}` : ''}</p>
            <StageTrack stage={i.stage} />
            {i.stage === 'feedback' && <p className="notice" style={{ marginTop: '1rem' }}>The panel has asked for changes. Open the idea to read their feedback and resubmit.</p>}
          </Link>
        ))}
      </div>
    );
  }

  if (me.role === 'evaluator') {
    const { data } = await sb
      .from('assignments')
      .select('submitted_at, created_at, ideas!inner(id, ref, title, stage, district, version)')
      .eq('evaluator_id', me.id)
      .order('created_at', { ascending: false });
    const rows = (data ?? []) as unknown as { submitted_at: string | null; created_at: string; ideas: Pick<Idea, 'id' | 'ref' | 'title' | 'stage' | 'district' | 'version'> }[];
    const todo = rows.filter((r) => !r.submitted_at && r.ideas.stage === 'in_review');
    return (
      <div className="stack">
        <h1>Ideas to evaluate</h1>
        <p className="muted">{todo.length ? `${todo.length} waiting for your scores.` : 'You are all caught up.'}</p>
        <div className="card table-scroll">
          <table>
            <thead><tr><th>Idea</th><th>District</th><th>Stage</th><th>Your scoring</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ideas.id}>
                  <td><Link href={`/app/ideas/${r.ideas.id}`}>{r.ideas.title}</Link><br /><small>{r.ideas.ref} · v{r.ideas.version}</small></td>
                  <td>{r.ideas.district}</td>
                  <td><StageLabel stage={r.ideas.stage} /></td>
                  <td>{r.submitted_at ? `Done ${fmtDate(r.submitted_at)}` : r.ideas.stage === 'in_review' ? <strong>To do</strong> : 'Not open'}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4} className="muted">Nothing assigned to you yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Adjudicators and admins: what needs a decision
  const [{ data: ideas }, { data: assignments }] = await Promise.all([
    sb.from('ideas').select('id, ref, title, stage, district, submitted_at, stage_changed_at').in('stage', ['submitted', 'in_review', 'approved']).order('stage_changed_at'),
    sb.from('assignments').select('idea_id, submitted_at'),
  ]);
  const byIdea = new Map<string, { total: number; done: number }>();
  for (const a of assignments ?? []) {
    const x = byIdea.get(a.idea_id) ?? { total: 0, done: 0 };
    x.total++;
    if (a.submitted_at) x.done++;
    byIdea.set(a.idea_id, x);
  }
  const list = (ideas ?? []) as Pick<Idea, 'id' | 'ref' | 'title' | 'stage' | 'district' | 'submitted_at' | 'stage_changed_at'>[];
  const newOnes = list.filter((i) => i.stage === 'submitted');
  const ready = list.filter((i) => i.stage === 'in_review' && (byIdea.get(i.id)?.total ?? 0) > 0 && byIdea.get(i.id)!.done === byIdea.get(i.id)!.total);
  const scoring = list.filter((i) => i.stage === 'in_review' && !ready.includes(i));
  const toAward = list.filter((i) => i.stage === 'approved');

  const Block = ({ title, items, note }: { title: string; items: typeof list; note: (i: (typeof list)[number]) => string }) => (
    <section className="card">
      <h2>{title} <span className="muted">({items.length})</span></h2>
      {items.length === 0 ? <p className="muted">Nothing here.</p> : (
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {items.slice(0, 8).map((i) => (
            <li key={i.id}><Link href={`/app/ideas/${i.id}`}>{i.title}</Link> <small>{i.ref} · {note(i)}</small></li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="stack">
      <div className="row between">
        <h1>What needs attention</h1>
        <Link className="btn secondary" href="/app/ideas">See all ideas</Link>
      </div>
      <div className="grid cols-2">
        <Block title="New, assign evaluators" items={newOnes} note={(i) => `since ${fmtDate(i.submitted_at)}`} />
        <Block title="Scored, ready to decide" items={ready} note={(i) => `${byIdea.get(i.id)?.done} evaluators done`} />
        <Block title="Being scored" items={scoring} note={(i) => `${byIdea.get(i.id)?.done ?? 0} of ${byIdea.get(i.id)?.total ?? 0} done`} />
        <Block title="Approved, ready to award" items={toAward} note={(i) => `approved ${fmtDate(i.stage_changed_at)}`} />
      </div>
    </div>
  );
}
