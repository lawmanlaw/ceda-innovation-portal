import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { StageLabel } from '@/components/stage';
import Icon, { type IconName } from '@/components/icon';
import { Activity, Stat, Steps, Tile, tone, type Step } from '@/components/dash';
import { STAGE_LABEL, type Stage } from '@/lib/types';
import type { Idea } from '@/lib/types';
import { fmtDate } from '@/lib/util';

const hello = (name: string | null | undefined) => {
  const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Gaborone' }));
  return `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}${name ? `, ${name.split(' ')[0]}` : ''}`;
};
const STAGE_PCT: Record<string, number> = { submitted: 20, in_review: 45, feedback: 45, approved: 80, awarded: 100, rejected: 100, withdrawn: 100 };
const STAGE_ICON: Record<string, IconName> = { submitted: 'send', in_review: 'review', feedback: 'chat', approved: 'check', awarded: 'award', rejected: 'list', withdrawn: 'list' };

export const metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ conflict?: string }> }) {
  const sp = await searchParams;
  const me = await requireMe();
  if (me.role === 'agent') redirect('/app/agent');
  if (me.role === 'observer') redirect('/app/ideas');
  const sb = await supabaseServer();

  if (me.role === 'submitter') {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [{ data }, { data: saved }, { data: alerts }] = await Promise.all([
      sb.from('ideas').select('*').eq('owner_id', me.id).order('updated_at', { ascending: false }),
      sb.from('interests').select('challenge_id, challenges(title, district)').eq('user_id', me.id).eq('saved', true).limit(3),
      sb.from('notifications').select('created_at').eq('user_id', me.id).gte('created_at', since),
    ]);
    const all = (data ?? []) as Idea[];
    const drafts = all.filter((i) => i.stage === 'draft');
    const ideas = all.filter((i) => i.stage !== 'draft');
    const basket = (saved ?? []) as unknown as { challenge_id: string; challenges: { title: string; district: string | null } | null }[];
    const steps: Step[] = [
      ...ideas.filter((i) => i.stage === 'feedback').map((i) => ({ href: `/app/ideas/${i.id}`, icon: 'chat' as const, title: `Reply to the panel: ${i.title}`, sub: 'They asked for changes', t: 'orange' as const })),
      ...drafts.map((d) => ({ href: `/app/ideas/new?draft=${d.id}`, icon: 'send' as const, title: `Finish your draft: ${d.title || 'Untitled idea'}`, sub: `Last saved ${fmtDate(d.updated_at, true)}`, t: 'maroon' as const })),
      ...basket.map((b) => ({ href: '/app/challenges', icon: 'bulb' as const, title: b.challenges?.title ?? 'Saved challenge', sub: `In your basket${b.challenges?.district ? ` · ${b.challenges.district}` : ''}`, t: 'gold' as const })),
      ...(ideas.length || drafts.length ? [] : [{ href: '/app/ideas/new', icon: 'plus' as const, title: 'Start your first idea', sub: 'About 10 minutes, saves as you type', t: 'maroon' as const }]),
      { href: '/app/challenges', icon: 'bulb', title: 'Discover community challenges', sub: 'Swipe through problems near you', t: 'brown' },
    ];
    const count = (st: string[]) => ideas.filter((i) => st.includes(i.stage)).length;
    return (
      <div className="dash">
        <div className="dash-main">
          <p className="dash-hello">{hello(me.full_name)}, welcome back</p>
          <div className="row between"><h1>My ideas</h1><Link className="btn small" href="/app/ideas/new">Submit an idea</Link></div>
          <div className="dtiles">
            {ideas.slice(0, 4).map((i, k) => (
              <Tile key={i.id} href={`/app/ideas/${i.id}`} title={i.title} sub={`${i.ref} · ${STAGE_LABEL[i.stage as Stage]}`} pct={STAGE_PCT[i.stage] ?? 0} icon={STAGE_ICON[i.stage] ?? 'bulb'} t={tone(k)} />
            ))}
            {ideas.length < 2 && <Link href="/app/ideas/new" className="dtile add"><Icon name="plus" still /><strong>New idea</strong><span>Saves as a draft while you type</span></Link>}
          </div>
          {ideas.length > 4 && <p><Link href="#all">See all {ideas.length} ideas</Link></p>}
          <h2>Next steps</h2>
          <Steps items={steps} empty="Nothing needs your action right now." />
          {ideas.length > 4 && (
            <section id="all" className="card">
              <h2>All my ideas</h2>
              <ul className="plain">{ideas.map((i) => <li key={i.id}><Link href={`/app/ideas/${i.id}`}>{i.title}</Link> <StageLabel stage={i.stage} /></li>)}</ul>
            </section>
          )}
        </div>
        <aside className="dash-side">
          <h2>Statistics</h2>
          <div className="dstats">
            <Stat label="Ideas submitted" value={ideas.length} />
            <Stat label="In review" value={count(['submitted', 'in_review', 'feedback'])} />
            <Stat label="Taken forward" value={count(['approved', 'awarded'])} />
            <Stat label="Challenges saved" value={basket.length} />
          </div>
          <Activity title="Activity" dates={(alerts ?? []).map((n) => n.created_at)} />
        </aside>
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
        {sp.conflict && <p className="notice" role="status">Thank you. You have stepped out of that review, it has been passed to another reviewer, and your declaration is on record.</p>}
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

  // Adjudicators and admins
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: ideas }, { data: assignments }, { data: overview }, { count: pendingReports }, { count: challenges }] = await Promise.all([
    sb.from('ideas').select('id, ref, title, stage, district, submitted_at, stage_changed_at').neq('stage', 'draft').order('stage_changed_at'),
    sb.from('assignments').select('idea_id, submitted_at'),
    sb.rpc('report_overview'),
    me.role === 'admin' ? sb.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'pending') : Promise.resolve({ count: 0 }),
    sb.from('challenges').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
  ]);
  const byIdea = new Map<string, { total: number; done: number }>();
  for (const a of assignments ?? []) {
    const x = byIdea.get(a.idea_id) ?? { total: 0, done: 0 };
    x.total++;
    if (a.submitted_at) x.done++;
    byIdea.set(a.idea_id, x);
  }
  const list = (ideas ?? []) as Pick<Idea, 'id' | 'ref' | 'title' | 'stage' | 'district' | 'submitted_at' | 'stage_changed_at'>[];
  const of = (st: string) => list.filter((i) => i.stage === st);
  const total = Math.max(1, list.length);
  const ready = of('in_review').filter((i) => (byIdea.get(i.id)?.total ?? 0) > 0 && byIdea.get(i.id)!.done === byIdea.get(i.id)!.total);
  const o = overview as { totals: { submitters: number }; avg_days_to_decision: number | null } | null;
  const steps: Step[] = [
    ...of('submitted').slice(0, 3).map((i) => ({ href: `/app/ideas/${i.id}`, icon: 'send' as const, title: `Assign evaluators: ${i.title}`, sub: `${i.ref} · since ${fmtDate(i.submitted_at)}`, t: 'maroon' as const })),
    ...ready.slice(0, 3).map((i) => ({ href: `/app/ideas/${i.id}`, icon: 'review' as const, title: `Ready to decide: ${i.title}`, sub: `${byIdea.get(i.id)?.done} evaluators done`, t: 'orange' as const })),
    ...of('approved').slice(0, 3).map((i) => ({ href: `/app/ideas/${i.id}`, icon: 'award' as const, title: `Ready to award: ${i.title}`, sub: `Approved ${fmtDate(i.stage_changed_at)}`, t: 'gold' as const })),
    ...(pendingReports ? [{ href: '/app/moderation', icon: 'check' as const, title: `${pendingReports} community ${pendingReports === 1 ? 'report' : 'reports'} to check`, sub: 'Approve before they go on the map', t: 'brown' as const }] : []),
  ];
  const tiles: { st: string; label: string; icon: IconName; href: string }[] = [
    { st: 'submitted', label: 'New ideas', icon: 'send', href: '/app/ideas?stage=submitted' },
    { st: 'in_review', label: 'In review', icon: 'review', href: '/app/ideas?stage=in_review' },
    { st: 'feedback', label: 'Needs changes', icon: 'chat', href: '/app/ideas?stage=feedback' },
    { st: 'approved', label: 'Approved', icon: 'check', href: '/app/ideas?stage=approved' },
  ];
  return (
    <div className="dash">
      <div className="dash-main">
        <p className="dash-hello">{hello(me.full_name)}, welcome back</p>
        <div className="row between"><h1>Overview</h1><Link className="btn secondary small" href="/app/ideas">All ideas</Link></div>
        <div className="dtiles">
          {tiles.map((x, k) => <Tile key={x.st} href={x.href} title={x.label} sub={`${of(x.st).length} ${of(x.st).length === 1 ? 'idea' : 'ideas'}`} pct={(of(x.st).length / total) * 100} icon={x.icon} t={tone(k)} />)}
        </div>
        <h2>What needs attention</h2>
        <Steps items={steps} empty="Nothing is waiting on you. Well done." />
      </div>
      <aside className="dash-side">
        <h2>Statistics</h2>
        <div className="dstats">
          <Stat label="Ideas in the portal" value={list.length} />
          <Stat label="Innovators taking part" value={o?.totals.submitters ?? 0} />
          <Stat label="Community challenges" value={challenges ?? 0} />
          <Stat label="Average days to decide" value={o?.avg_days_to_decision ?? '-'} />
        </div>
        <Activity title="New ideas" dates={list.filter((i) => (i.submitted_at ?? '') >= since).map((i) => i.submitted_at)} />
      </aside>
    </div>
  );
}
