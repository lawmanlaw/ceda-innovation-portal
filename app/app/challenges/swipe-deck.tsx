'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { districtPoint, km } from '@/lib/geo';
import Bokamoso from '@/components/bokamoso';

export type Card = { id: string; title: string; description: string; sector: string | null; district: string | null; lat: number; lng: number; upvotes: number; has_photo: boolean };
const NEAR_KM = 75;

export default function SwipeDeck({ userId, home, cards, decided, districts }: {
  userId: string; home: string | null; cards: Card[]; decided: { challenge_id: string; saved: boolean }[]; districts: string[];
}) {
  const sb = supabaseBrowser();
  const [done, setDone] = useState(() => new Map(decided.map((d) => [d.challenge_id, d.saved])));
  const [area, setArea] = useState<string>('near');
  const [here, setHere] = useState(() => districtPoint(home));
  const [tab, setTab] = useState<'swipe' | 'basket'>('swipe');
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<null | 'left' | 'right'>(null);
  const start = useRef<number | null>(null);

  const dist = (c: Card) => (here ? km(here.lat, here.lng, c.lat, c.lng) : null);
  const deck = useMemo(() => {
    const open = cards.filter((c) => !done.has(c.id) && (area === 'near' || c.district === area));
    return area === 'near' && here
      ? open.sort((a, b) => km(here.lat, here.lng, a.lat, a.lng) - km(here.lat, here.lng, b.lat, b.lng) || b.upvotes - a.upvotes)
      : open.sort((a, b) => b.upvotes - a.upvotes);
  }, [cards, done, area, here]);
  const top = deck[0];
  const basket = cards.filter((c) => done.get(c.id) === true);

  async function decide(saved: boolean) {
    if (!top || leaving) return;
    setLeaving(saved ? 'right' : 'left');
    const id = top.id;
    setTimeout(() => { setDone((m) => new Map(m).set(id, saved)); setLeaving(null); setDx(0); }, 200);
    await sb.from('interests').upsert({ user_id: userId, challenge_id: id, saved });
  }
  async function remove(id: string) {
    setDone((m) => { const n = new Map(m); n.delete(id); return n; });
    await sb.from('interests').delete().eq('user_id', userId).eq('challenge_id', id);
  }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (tab !== 'swipe' || (e.target as HTMLElement).closest('input, select, textarea')) return;
      if (e.key === 'ArrowRight') decide(true);
      if (e.key === 'ArrowLeft') decide(false);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setArea('near'); });
  }

  const d = top ? dist(top) : null;
  const style = leaving ? undefined : { transform: `translateX(${dx}px) rotate(${dx / 18}deg)` };

  return (
    <div className="stack">
      <div className="row between">
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'swipe'} aria-pressed={tab === 'swipe'} onClick={() => setTab('swipe')}>Discover</button>
          <button type="button" role="tab" aria-selected={tab === 'basket'} aria-pressed={tab === 'basket'} onClick={() => setTab('basket')}>My basket ({basket.length})</button>
        </div>
        {tab === 'swipe' && (
          <div className="row" style={{ gap: '.5rem' }}>
            <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
              <option value="near">Near me{home ? ` (${home})` : ''}</option>
              {districts.map((x) => <option key={x}>{x}</option>)}
            </select>
            <button type="button" className="btn ghost small" onClick={locate}>Use my location</button>
          </div>
        )}
      </div>

      {tab === 'swipe' ? (
        <div className="deck-wrap">
          {top ? (
            <>
              <div className="deck">
                {deck[1] && <div className="swipe-card under" aria-hidden="true" />}
                <article key={top.id} className={`swipe-card${leaving ? ` out-${leaving}` : ''}`} style={style}
                  onPointerDown={(e) => { start.current = e.clientX; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                  onPointerMove={(e) => { if (start.current != null) setDx(e.clientX - start.current); }}
                  onPointerUp={() => { const v = dx; start.current = null; if (v > 110) decide(true); else if (v < -110) decide(false); else setDx(0); }}
                  aria-label={top.title}>
                  {dx > 40 && <span className="stamp yes">Save</span>}
                  {dx < -40 && <span className="stamp no">Skip</span>}
                  {top.has_photo ? <img src={`/challenges/photo/${top.id}`} alt="" draggable={false} className="swipe-photo" /> : <div className="swipe-photo none" aria-hidden="true">{top.sector ?? 'Challenge'}</div>}
                  <div className="swipe-body">
                    <p className="muted" style={{ margin: 0 }}>
                      {top.district ?? 'Botswana'}{d != null ? ` · ${Math.round(d)} km away` : ''}{top.sector ? ` · ${top.sector}` : ''}
                      {d != null && d <= NEAR_KM && <strong className="near"> · Near you</strong>}
                    </p>
                    <h2>{top.title}</h2>
                    <p className="swipe-text">{top.description}</p>
                    <p className="muted" style={{ margin: 0 }}>{top.upvotes} {top.upvotes === 1 ? 'person says' : 'people say'} this affects them</p>
                  </div>
                </article>
              </div>
              <div className="row deck-buttons">
                <button type="button" className="btn secondary" onClick={() => decide(false)} aria-label="Skip this challenge">Skip</button>
                <button type="button" className="btn" onClick={() => decide(true)} aria-label="Save to my basket">Save to basket</button>
              </div>
              <p className="muted" style={{ textAlign: 'center', fontSize: '.85rem' }}>{deck.length} left here. On a keyboard, use the left and right arrows.</p>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center' }}>
              <Bokamoso mode="yes" size={100} />
              <p>You have seen every challenge {area === 'near' ? 'for now' : `in ${area}`}. Try another area, or look in your basket.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="stack">
          {!basket.length && <p className="card muted">Your basket is empty. Swipe right on challenges you would like to work on.</p>}
          {basket.map((c) => (
            <article key={c.id} className="card row between" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{c.title}</h2>
                <p className="muted" style={{ margin: '.2rem 0' }}>{c.district}{c.sector ? ` · ${c.sector}` : ''} · {c.upvotes} upvotes</p>
              </div>
              <div className="row" style={{ gap: '.4rem' }}>
                <Link className="btn small" href="/app/ideas/new">Start an idea</Link>
                <button type="button" className="btn ghost small" onClick={() => remove(c.id)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
