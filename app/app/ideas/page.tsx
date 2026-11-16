import Link from 'next/link';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { StageLabel } from '@/components/stage';
import { STAGE_LABEL, type Stage } from '@/lib/types';
import { fmtDate } from '@/lib/util';
import { DistrictMap, type DistrictStats } from '@/components/district-map';

export const metadata = { title: 'All ideas' };

export default async function AllIdeas({ searchParams }: { searchParams: Promise<{ stage?: string; district?: string; q?: string }> }) {
  await requireMe('adjudicator', 'admin', 'observer');
  const sp = await searchParams;
  const sb = await supabaseServer();
  let query = sb.from('ideas').select('id, ref, title, stage, district, submitted_at, stage_changed_at, version').order('submitted_at', { ascending: false }).limit(200);
  if (sp.stage && sp.stage in STAGE_LABEL) query = query.eq('stage', sp.stage);
  if (sp.district) query = query.eq('district', sp.district.slice(0, 60));
  if (sp.q) query = query.ilike('title', `%${sp.q.slice(0, 80).replace(/[%_\\]/g, '')}%`);
  // Map counts follow the stage and search filters but not the district one, so every district stays comparable
  let mapQuery = sb.from('ideas').select('id, title, district, stage, lat, lng').neq('stage', 'draft').limit(5000);
  if (sp.stage && sp.stage in STAGE_LABEL) mapQuery = mapQuery.eq('stage', sp.stage);
  if (sp.q) mapQuery = mapQuery.ilike('title', `%${sp.q.slice(0, 80).replace(/[%_\\]/g, '')}%`);
  const [{ data: ideas }, { data: districts }, { data: mapRows }] = await Promise.all([query, sb.from('districts').select('name').order('name'), mapQuery]);
  const stats: DistrictStats = {};
  for (const r of mapRows ?? []) {
    const d = (stats[r.district] ??= { total: 0, stages: {} });
    d.total++;
    d.stages[r.stage as Stage] = (d.stages[r.stage as Stage] ?? 0) + 1;
  }

  return (
    <div className="stack">
      <h1>All ideas</h1>
      <form className="row card" role="search">
        <input name="q" placeholder="Search titles" defaultValue={sp.q} aria-label="Search titles" style={{ flex: 2, minWidth: 180 }} />
        <select name="stage" defaultValue={sp.stage ?? ''} aria-label="Stage" style={{ flex: 1, minWidth: 150 }}>
          <option value="">Any stage</option>
          {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="district" defaultValue={sp.district ?? ''} aria-label="District" style={{ flex: 1, minWidth: 150 }}>
          <option value="">Any district</option>
          {districts?.map((d) => <option key={d.name}>{d.name}</option>)}
        </select>
        <button className="btn secondary">Filter</button>
      </form>
      <DistrictMap stats={stats} selected={sp.district} pins={(mapRows ?? []).filter((r) => r.lat != null).map((r) => ({ id: r.id, title: r.title, lat: r.lat as number, lng: r.lng as number }))} />
      <div className="card table-scroll">
        <table>
          <thead><tr><th>Idea</th><th>District</th><th>Stage</th><th>Submitted</th><th>Last change</th></tr></thead>
          <tbody>
            {ideas?.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/app/ideas/${i.id}`}>{i.title}</Link><br /><small>{i.ref}{i.version > 1 ? ` · v${i.version}` : ''}</small></td>
                <td>{i.district}</td>
                <td><StageLabel stage={i.stage as Stage} /></td>
                <td>{fmtDate(i.submitted_at)}</td>
                <td>{fmtDate(i.stage_changed_at)}</td>
              </tr>
            ))}
            {!ideas?.length && <tr><td colSpan={5} className="muted">No ideas match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
