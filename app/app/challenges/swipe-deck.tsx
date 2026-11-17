'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase/client';
import { districtPoint, km } from '@/lib/geo';
import { upvote } from '@/app/report/actions';
import Bokamoso from '@/components/bokamoso';
import SectorArt from '@/components/sector-art';

export type Card = { id: string; title: string; description: string; sector: string | null; district: string | null; lat: number; lng: number; upvotes: number; has_photo: boolean };
const NEAR_KM = 75;
const FLY = 140; // drag distance that throws a card
const FLICK = 0.55; // or this many px per ms

type Drag = { x: number; y: number; t: number; vx: number; sx: number; sy: number };

const Heart = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.8C20 15.8 12 21 12 21z" fill="currentColor" /></svg>;
const Cross = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" fill="none" /></svg>;
const Up = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
const Pin = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z" fill="currentColor" /><circle cx="12" cy="10" r="2.6" fill="#7a1e1e" /></svg>;

export default function SwipeDeck({ userId, home, cards, decided, districts }: {
  userId: string; home: string | null; cards: Card[]; decided: { challenge_id: string; saved: boolean }[]; districts: string[];
}) {
  const sb = supabaseBrowser();
  const [done, setDone] = useState(() => new Map(decided.map((d) => [d.challenge_id, d.saved])));
  const [area, setArea] = useState('near');
  const [here, setHere] = useState(() => districtPoint(home));
  const [tab, setTab] = useState<'swipe' | 'basket'>('swipe');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fly, setFly] = useState<null | { dir: 1 | -1; y: number }>(null);
  const [burst, setBurst] = useState<null | 'save' | 'skip'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const drag = useRef<Drag | null>(null);
  const deckRef = useRef<HTMLDivElement>(null);

  const deck = useMemo(() => {
    const open = cards.filter((c) => !done.has(c.id) && (area === 'near' || c.district === area));
    return area === 'near' && here
      ? open.sort((a, b) => km(here.lat, here.lng, a.lat, a.lng) - km(here.lat, here.lng, b.lat, b.lng) || b.upvotes - a.upvotes)
      : open.sort((a, b) => b.upvotes - a.upvotes);
  }, [cards, done, area, here]);
  const top = deck[0];
  const basket = cards.filter((c) => done.get(c.id) === true);
  const width = () => deckRef.current?.clientWidth ?? 360;
  const progress = fly ? 1 : Math.min(1, Math.abs(pos.x) / FLY);

  function decide(saved: boolean, y = 0) {
    if (!top || fly) return;
    const id = top.id;
    setFly({ dir: saved ? 1 : -1, y });
    setBurst(saved ? 'save' : 'skip');
    if (navigator.vibrate) navigator.vibrate(saved ? [12, 40, 12] : 10);
    setTimeout(() => setBurst(null), 650);
    setTimeout(() => { setDone((m) => new Map(m).set(id, saved)); setFly(null); setPos({ x: 0, y: 0 }); }, 340);
    void sb.from('interests').upsert({ user_id: userId, challenge_id: id, saved });
  }
  async function vote() {
    if (!top) return;
    const r = await upvote(top.id);
    if (r.error) { setToast(r.error); } else { setVotes((v) => ({ ...v, [top.id]: r.n ?? top.upvotes })); setToast('Thanks, your vote is counted.'); }
    setTimeout(() => setToast(null), 2400);
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

  const onDown = (e: React.PointerEvent) => {
    if (fly) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, sx: e.clientX, sy: e.clientY };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const now = performance.now();
    d.vx = (e.clientX - d.x) / Math.max(1, now - d.t);
    d.x = e.clientX; d.y = e.clientY; d.t = now;
    setPos({ x: e.clientX - d.sx, y: (e.clientY - d.sy) * 0.35 });
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (pos.x > FLY || d.vx > FLICK) decide(true, pos.y);
    else if (pos.x < -FLY || d.vx < -FLICK) decide(false, pos.y);
    else setPos({ x: 0, y: 0 }); // springs back through the CSS transition
  };

  const d = top && here ? km(here.lat, here.lng, top.lat, top.lng) : null;
  const topStyle: React.CSSProperties = fly
    ? { transform: `translate(${fly.dir * width() * 1.6}px, ${fly.y - 40}px) rotate(${fly.dir * 32}deg)` }
    : { transform: `translate(${pos.x}px, ${pos.y}px) rotate(${pos.x / 14}deg)` };

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
            <button type="button" className="btn ghost small" onClick={() => navigator.geolocation?.getCurrentPosition((p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setArea('near'); })}>Use my location</button>
          </div>
        )}
      </div>

      {tab === 'swipe' ? (
        <div className="deck-wrap">
          {top ? (
            <>
              <div ref={deckRef} className="deck" style={{ '--p': progress } as React.CSSProperties}>
                {deck.slice(1, 3).reverse().map((c, i, arr) => {
                  const depth = arr.length - i;
                  return (
                    <div key={c.id} className="swipe-card under" data-depth={depth} aria-hidden="true">
                      {c.has_photo ? <img src={`/challenges/photo/${c.id}`} alt="" className="swipe-photo" draggable={false} /> : <SectorArt sector={c.sector} className="swipe-photo" />}
                      <div className="swipe-shade" />
                      <div className="swipe-body"><h2>{c.title}</h2></div>
                    </div>
                  );
                })}
                <article key={top.id} className={`swipe-card top${dragging ? ' dragging' : ''}${fly ? ' flying' : ''}`} style={topStyle}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                  aria-label={`${top.title}. Swipe right to save, left to skip.`}>
                  {top.has_photo ? <img src={`/challenges/photo/${top.id}`} alt="" draggable={false} className="swipe-photo" /> : <SectorArt sector={top.sector} className="swipe-photo" />}
                  <div className="swipe-shade" />
                  <div className="tint tint-yes" style={{ opacity: Math.max(0, pos.x / FLY) }}><span style={{ transform: `scale(${0.4 + Math.min(1, Math.max(0, pos.x / FLY)) * 0.8})` }}><Heart /></span></div>
                  <div className="tint tint-no" style={{ opacity: Math.max(0, -pos.x / FLY) }}><span style={{ transform: `scale(${0.4 + Math.min(1, Math.max(0, -pos.x / FLY)) * 0.8})` }}><Cross /></span></div>
                  <div className="swipe-body">
                    {(d != null || top.district) && (
                      <span className="swipe-info"><Pin />{top.district ?? 'Botswana'}{d != null ? ` · ${Math.round(d)} km away` : ''}{d != null && d <= NEAR_KM ? ' · Near you' : ''}</span>
                    )}
                    <h2>{top.title}</h2>
                    <p className="swipe-text">{top.description}</p>
                    <p className="swipe-meta">{top.sector ? `${top.sector} · ` : ''}{votes[top.id] ?? top.upvotes} {(votes[top.id] ?? top.upvotes) === 1 ? 'person says' : 'people say'} this affects them</p>
                  </div>
                </article>
                {burst && <div className={`burst burst-${burst}`} aria-hidden="true">{burst === 'save' ? <Heart /> : <Cross />}</div>}
              </div>
              <div className="fab-row">
                <button type="button" className="fab fab-no" onClick={() => decide(false)} aria-label="Skip this challenge"><Cross /></button>
                <button type="button" className="fab vote" onClick={vote} aria-label="Upvote: this affects me too"><Up /></button>
                <button type="button" className="fab save" onClick={() => decide(true)} aria-label="Save to my basket"><Heart /></button>
              </div>
              <p className="muted" role="status" style={{ textAlign: 'center', fontSize: '.85rem', minHeight: '1.3em' }}>{toast ?? `${deck.length} left here. Drag the card, or use the arrow keys.`}</p>
            </>
          ) : (
            <div className="card empty-deck">
              <Bokamoso mode="yes" size={110} />
              <p>You have seen every challenge {area === 'near' ? 'for now' : `in ${area}`}. Try another area, or open your basket.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="basket">
          {!basket.length && (
            <div className="card empty-deck"><SectorArt sector="other" className="empty-art" /><p>Your basket is empty. Swipe right on challenges you would like to work on.</p></div>
          )}
          {basket.map((c) => (
            <article key={c.id} className="card basket-item">
              {c.has_photo ? <img src={`/challenges/photo/${c.id}`} alt="" className="basket-thumb" /> : <SectorArt sector={c.sector} className="basket-thumb" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2>{c.title}</h2>
                <p className="muted" style={{ margin: '.2rem 0 0' }}>{c.district}{c.sector ? ` · ${c.sector}` : ''} · {c.upvotes} upvotes</p>
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
