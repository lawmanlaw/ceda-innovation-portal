import Link from 'next/link';
import PublicHeader from '@/components/public-header';
import Upvote from '@/components/upvote';
import SectorArt from '@/components/sector-art';
import { supabaseServer } from '@/lib/supabase/server';
import { MAP_W, MAP_H, REGIONS } from '@/lib/bw-map';
import { project } from '@/lib/geo';

export const metadata = { title: 'Community challenges' };

type Ch = { id: string; code: string; title: string; description: string; sector: string | null; district: string | null; lat: number; lng: number; upvotes: number; has_photo: boolean };

export default async function Challenges({ searchParams }: { searchParams: Promise<{ district?: string }> }) {
  const { district } = await searchParams;
  const sb = await supabaseServer();
  let q = sb.from('challenges').select('id, code, title, description, sector, district, lat, lng, upvotes, has_photo').eq('status', 'approved').order('upvotes', { ascending: false }).limit(300);
  if (district) q = q.eq('district', district.slice(0, 60));
  const { data } = await q;
  const list = (data ?? []) as Ch[];
  return (
    <>
      <PublicHeader />
      <main id="main"><div className="wrap stack">
        <div className="row between">
          <h1>Community challenges</h1>
          <Link className="btn" href="/report">Report a problem</Link>
        </div>
        <p className="muted">Problems reported by people across Botswana and checked by CEDA. Innovators can take them on. Upvote the ones that affect you, so the most felt problems rise to the top.</p>
        <div className="grid ch-layout">
          <section className="card">
            <svg viewBox={`-6 -6 ${MAP_W + 12} ${MAP_H + 12}`} className="ch-map" role="img" aria-label={`${list.length} challenges on the map of Botswana`}>
              {REGIONS.map((r) => <path key={r.name} d={r.d} />)}
              {list.map((c) => { const { x, y } = project(c.lat, c.lng); return <a key={c.id} href={`#${c.code}`}><title>{c.title}</title><circle cx={x} cy={y} r={6 + Math.min(10, Math.sqrt(c.upvotes))} /></a>; })}
            </svg>
            {district && <p><Link href="/challenges">Show all districts</Link></p>}
          </section>
          <div className="stack">
            {!list.length && <div className="card empty-deck"><SectorArt sector="other" className="empty-art" /><p>No challenges here yet. Be the first to report one.</p></div>}
            {list.map((c) => (
              <article key={c.id} id={c.code} className="card ch-card">
                {c.has_photo ? <img src={`/challenges/photo/${c.id}`} alt="" loading="lazy" className="ch-photo" /> : <SectorArt sector={c.sector} className="ch-photo" />}
                <div>
                  <h2>{c.title}</h2>
                  <p className="muted" style={{ margin: '0 0 .4rem' }}>{[c.sector, c.district && <Link key="d" href={`/challenges?district=${encodeURIComponent(c.district)}`}>{c.district}</Link>].filter(Boolean).map((x, i) => <span key={i}>{i ? ' · ' : ''}{x}</span>)}</p>
                  <p>{c.description}</p>
                  <Upvote id={c.id} n={c.upvotes} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div></main>
    </>
  );
}
