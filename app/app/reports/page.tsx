import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { STAGE_LABEL, type Stage } from '@/lib/types';

export const metadata = { title: 'Reports' };

type Overview = {
  totals: { ideas: number; submitters: number; this_month: number; awarded: number };
  by_stage: Record<string, number>;
  by_district: Record<string, number>;
  by_category: { name: string; n: number }[];
  by_week: { week: string; n: number }[];
  avg_days_to_decision: number | null;
  evaluator_load: { name: string; assigned: number; done: number }[];
  chat: { threads: number; missed: number; avg_first_reply_min: number | null; avg_rating: number | null };
};

function Bars({ rows }: { rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return (
    <table>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td style={{ width: '40%' }}>{r.label}</td>
            <td><div className="bar" style={{ width: `${(r.n / max) * 100}%` }} /></td>
            <td style={{ width: 48, textAlign: 'right' }}>{r.n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Reports() {
  await requireMe('adjudicator', 'admin');
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('report_overview');
  if (error || !data) return <p className="notice bad">Reports are not available right now. Please try again.</p>;
  const r = data as Overview;

  return (
    <div className="stack">
      <div className="row between">
        <h1>Reports</h1>
        <a className="btn secondary" href="/app/reports/export">Download ideas as CSV</a>
      </div>

      <div className="grid cols-4">
        <div className="card stat"><strong>{r.totals.ideas}</strong><span>ideas submitted</span></div>
        <div className="card stat"><strong>{r.totals.submitters}</strong><span>people taking part</span></div>
        <div className="card stat"><strong>{r.totals.this_month}</strong><span>submitted this month</span></div>
        <div className="card stat"><strong>{r.avg_days_to_decision ?? '-'}</strong><span>average days to a decision</span></div>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <h2>Ideas by stage</h2>
          <Bars rows={(Object.keys(STAGE_LABEL) as Stage[]).map((s) => ({ label: STAGE_LABEL[s], n: r.by_stage[s] ?? 0 }))} />
        </section>
        <section className="card">
          <h2>Where ideas come from</h2>
          <Bars rows={Object.entries(r.by_district).map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n)} />
        </section>
        <section className="card">
          <h2>Categories</h2>
          <Bars rows={r.by_category.map((c) => ({ label: c.name, n: c.n }))} />
        </section>
        <section className="card">
          <h2>Submissions per week</h2>
          <Bars rows={r.by_week.map((w) => ({ label: `Week of ${w.week}`, n: w.n }))} />
        </section>
        <section className="card">
          <h2>Evaluator workload</h2>
          {r.evaluator_load.length ? (
            <table>
              <thead><tr><th>Evaluator</th><th>Assigned</th><th>Scored</th></tr></thead>
              <tbody>{r.evaluator_load.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.assigned}</td><td>{e.done}</td></tr>)}</tbody>
            </table>
          ) : <p className="muted">No assignments yet.</p>}
        </section>
        <section className="card">
          <h2>Live chat</h2>
          <table>
            <tbody>
              <tr><td>Conversations</td><td>{r.chat.threads}</td></tr>
              <tr><td>Outside hours or unanswered</td><td>{r.chat.missed}</td></tr>
              <tr><td>Average first reply</td><td>{r.chat.avg_first_reply_min ?? '-'} min</td></tr>
              <tr><td>Average rating</td><td>{r.chat.avg_rating ?? '-'} / 5</td></tr>
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
