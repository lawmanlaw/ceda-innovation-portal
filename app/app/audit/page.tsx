import Link from 'next/link';
import { requireMe, supabaseServer } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/util';

export const metadata = { title: 'Audit trail' };

const TABLES = ['ideas', 'scores', 'feedback', 'assignments', 'profiles', 'criteria', 'form_fields', 'attachments', 'chat_threads', 'auth.users'];

// Shows which fields changed, without dumping whole records
function diff(oldD: Record<string, unknown> | null, newD: Record<string, unknown> | null) {
  if (!oldD || !newD) return null;
  return Object.keys(newD)
    .filter((k) => !['updated_at', 'stage_changed_at'].includes(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
    .map((k) => `${k}: ${String(oldD[k] ?? '').slice(0, 40)} → ${String(newD[k] ?? '').slice(0, 40)}`)
    .join('; ');
}

export default async function Audit({ searchParams }: { searchParams: Promise<{ table?: string; page?: string }> }) {
  await requireMe('admin');
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page) || 0);
  const sb = await supabaseServer();
  let q = sb.from('audit_log').select('id, actor_id, action, table_name, record_id, old_data, new_data, created_at').order('id', { ascending: false }).range(page * 50, page * 50 + 49);
  if (sp.table && TABLES.includes(sp.table)) q = q.eq('table_name', sp.table);
  const { data } = await q;
  const actors = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: people } = actors.length ? await sb.from('profiles').select('id, full_name, email').in('id', actors) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  return (
    <div className="stack">
      <h1>Audit trail</h1>
      <p className="muted">Every change to ideas, scores, roles and settings, plus every sign-in. Entries cannot be edited or deleted.</p>
      <form className="row">
        <select name="table" defaultValue={sp.table ?? ''} aria-label="Area" style={{ width: 'auto' }}>
          <option value="">Everything</option>
          {TABLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn secondary">Filter</button>
      </form>
      <div className="card table-scroll">
        <table>
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                <td>{r.actor_id ? who.get(r.actor_id) ?? 'Unknown user' : 'System'}</td>
                <td>{r.action} {r.table_name}<br /><small>{r.record_id}</small></td>
                <td><small>{diff(r.old_data, r.new_data) ?? ''}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        {page > 0 && <Link className="btn ghost" href={`/app/audit?page=${page - 1}${sp.table ? `&table=${sp.table}` : ''}`}>Newer</Link>}
        {data?.length === 50 && <Link className="btn ghost" href={`/app/audit?page=${page + 1}${sp.table ? `&table=${sp.table}` : ''}`}>Older</Link>}
      </div>
    </div>
  );
}
