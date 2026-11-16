import PublicHeader from '@/components/public-header';
import { supabaseServer } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/util';

export const metadata = { title: 'Track a report' };
const WORDS: Record<string, string> = { pending: 'Waiting for a moderator', approved: 'Approved and on the challenge map', rejected: 'Not published' };

export default async function Track({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const clean = (code ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
  const sb = await supabaseServer();
  const row = clean ? ((await sb.rpc('track_challenge', { p_code: clean })).data as { title: string; status: string; created_at: string; moderated_at: string | null; upvotes: number }[] | null)?.[0] : null;
  return (
    <>
      <PublicHeader />
      <main id="main"><div className="wrap stack" style={{ maxWidth: 560 }}>
        <h1>Track a report</h1>
        <form className="row card" role="search">
          <input name="code" placeholder="BW-1A2B3C" defaultValue={clean} aria-label="Tracking code" style={{ flex: 1 }} />
          <button className="btn">Check</button>
        </form>
        {clean && !row && <p className="notice bad">No report has that code. Check it and try again.</p>}
        {row && (
          <section className="card">
            <h2>{row.title}</h2>
            <dl className="facts">
              <dt>Status</dt><dd>{WORDS[row.status]}</dd>
              <dt>Reported</dt><dd>{fmtDate(row.created_at)}</dd>
              {row.moderated_at && <><dt>Reviewed</dt><dd>{fmtDate(row.moderated_at)}</dd></>}
              {row.status === 'approved' && <><dt>Upvotes</dt><dd>{row.upvotes}</dd></>}
            </dl>
          </section>
        )}
      </div></main>
    </>
  );
}
