import { requireMe, supabaseServer } from '@/lib/supabase/server';
import ActionForm from '@/components/action-form';
import { moderateChallenge } from '@/app/app/actions';
import { fmtDate } from '@/lib/util';

export const metadata = { title: 'Moderation' };

export default async function Moderation() {
  await requireMe('admin');
  const sb = await supabaseServer();
  const { data } = await sb.from('challenges').select('id, code, title, description, sector, district, has_photo, created_at').eq('status', 'pending').order('created_at').limit(50);
  const list = data ?? [];
  return (
    <div className="stack">
      <h1>Community reports to check</h1>
      <p className="muted">{list.length ? `${list.length} waiting. Check the text is about a real problem and that photos show no faces of people who did not agree and nothing offensive.` : 'Nothing waiting. Well done.'}</p>
      {list.map((c) => (
        <article key={c.id} className="card ch-card">
          {c.has_photo && <a href={`/challenges/photo/${c.id}`} target="_blank" rel="noopener noreferrer"><img src={`/challenges/photo/${c.id}`} alt="Reported photo" className="ch-photo" /></a>}
          <div className="stack" style={{ gap: '.5rem' }}>
            <h2>{c.title}</h2>
            <p className="muted" style={{ margin: 0 }}>{c.code} · {c.district ?? 'Unknown district'}{c.sector ? ` · ${c.sector}` : ''} · {fmtDate(c.created_at)}</p>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.description}</p>
            <ActionForm action={moderateChallenge} submit="Approve" reset extra={<>
              {c.has_photo && <button className="btn secondary" name="decision" value="no-photo">Approve without photo</button>}
              <button className="btn danger" name="decision" value="reject">Do not publish</button>
            </>}>
              <input type="hidden" name="challenge_id" value={c.id} />
              <input type="hidden" name="decision" value="approve" />
              <input name="note" maxLength={300} placeholder="Note for the record (optional)" aria-label="Moderator note" />
            </ActionForm>
          </div>
        </article>
      ))}
    </div>
  );
}
