'use client';

import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MAP_W, MAP_H, REGIONS, TOWNS } from '@/lib/bw-map';
import { project } from '@/lib/geo';
import { STAGE_LABEL, type Stage } from '@/lib/types';

export type DistrictStats = Record<string, { total: number; stages: Partial<Record<Stage, number>> }>;

const STEPS = ['#f3ebe7', '#e3c4b8', '#c27a64', '#7a1e1e'];

function step(n: number, max: number) {
  if (!n) return 0;
  return Math.min(3, Math.max(1, Math.ceil((n / max) * 3)));
}

type Pin = { id: string; title: string; lat: number; lng: number };
const POP: Record<string, number> = Object.fromEntries([...REGIONS, ...TOWNS].map((r) => [r.name, r.pop]));
const rate = (n: number, name: string) => (POP[name] ? (n / POP[name]) * 10000 : 0);

export function DistrictMap({ stats, selected, pins = [] }: { stats: DistrictStats; selected?: string; pins?: Pin[] }) {
  const [metric, setMetric] = useState<'count' | 'rate'>('count');
  const [showPins, setShowPins] = useState(true);
  const value = (name: string) => { const n = stats[name]?.total ?? 0; return metric === 'count' ? n : rate(n, name); };
  const router = useRouter();
  const params = useSearchParams();
  const box = useRef<HTMLDivElement>(null);
  const lastPointer = useRef(0);
  const [tip, setTip] = useState<{ name: string; x: number; y: number; pinned: boolean } | null>(null);
  const max = Math.max(metric === 'count' ? 1 : 0.0001, ...Object.keys(POP).map(value));

  function show(name: string, e: { clientX: number; clientY: number }, pinned = false) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ name, x: e.clientX - r.left, y: e.clientY - r.top, pinned });
  }

  function filter(name: string) {
    const next = new URLSearchParams(params.toString());
    if (selected === name) next.delete('district'); else next.set('district', name);
    router.push(`?${next.toString()}`, { scroll: false });
    setTip(null);
  }

  // Mouse: hover shows, click filters. Touch: first tap shows the card, the card's button filters.
  function handlers(name: string) {
    return {
      onPointerDown: () => { lastPointer.current = Date.now(); },
      onPointerMove: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') show(name, e); },
      onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setTip(null); },
      onClick: (e: React.MouseEvent) => {
        const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch';
        if (touch && tip?.name !== name) show(name, e, true); else filter(name);
      },
      onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); filter(name); } },
      onFocus: (e: React.FocusEvent<SVGElement>) => {
        if (Date.now() - lastPointer.current < 800) return; // focus from a tap or click, not the keyboard
        const b = e.currentTarget.getBoundingClientRect();
        show(name, { clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
      },
      onBlur: () => setTip(null),
      tabIndex: 0,
      role: 'button',
      'aria-label': `${name}: ${stats[name]?.total ?? 0} ideas. Press to ${selected === name ? 'clear the filter' : 'filter the table'}`,
      'aria-pressed': selected === name,
    };
  }

  const s = tip ? stats[tip.name] : undefined;
  const pop = tip ? (REGIONS.find((r) => r.name === tip.name) ?? TOWNS.find((t) => t.name === tip.name))?.pop : undefined;
  const flip = tip && box.current ? tip.x > box.current.clientWidth * 0.55 : false;

  return (
    <div className="dmap card">
      <div className="dmap-head">
        <h2>Ideas by district</h2>
        <div className="row" style={{ gap: '.5rem' }}>
          <div className="seg" role="group" aria-label="Colour districts by">
            <button type="button" aria-pressed={metric === 'count'} onClick={() => setMetric('count')}>Number of ideas</button>
            <button type="button" aria-pressed={metric === 'rate'} onClick={() => setMetric('rate')}>Per 10,000 people</button>
          </div>
          {pins.length > 0 && <label className="row consent" style={{ fontSize: '.85rem' }}><input type="checkbox" checked={showPins} onChange={(e) => setShowPins(e.target.checked)} /><span>Pins</span></label>}
        </div>
        <div className="dmap-legend" aria-hidden="true">
          <span>Fewer</span>{STEPS.map((c) => <i key={c} style={{ background: c }} />)}<span>More</span>
        </div>
      </div>
      <div className="dmap-box" ref={box} onPointerDown={(e) => { if (e.target === e.currentTarget) setTip(null); }}>
        <svg viewBox={`-6 -6 ${MAP_W + 12} ${MAP_H + 12}`} role="group" aria-label="Map of Botswana districts. Choose a district to filter the ideas below.">
          {REGIONS.map((r) => (
            <path key={r.name} d={r.d} fill={STEPS[step(value(r.name), max)]}
              className={`dmap-region${selected === r.name ? ' on' : ''}${tip?.name === r.name ? ' hot' : ''}`} {...handlers(r.name)} />
          ))}
          {REGIONS.filter((r) => r.name === selected || r.name === tip?.name).map((r) => (
            <path key={`o-${r.name}`} d={r.d} className={`dmap-outline${r.name === selected ? ' on' : ''}`} aria-hidden="true" />
          ))}
          {REGIONS.map((r) => (
            <text key={r.name} x={r.lx} y={r.ly} className={`dmap-label${step(value(r.name), max) === 3 ? ' light' : ''}`} aria-hidden="true">{r.name}</text>
          ))}
          {TOWNS.map((t) => (
            <g key={t.name} className={`dmap-town${selected === t.name ? ' on' : ''}${tip?.name === t.name ? ' hot' : ''}`} {...handlers(t.name)}>
              <path d={t.d} className="area" />
              <circle cx={t.x} cy={t.y} r={18} className="hit" />
              <circle cx={t.x} cy={t.y} r={(stats[t.name]?.total ?? 0) ? 9 : 6} className="dot" />
            </g>
          ))}
          {showPins && pins.map((p) => {
            const { x, y } = project(p.lat, p.lng);
            return (
              <Link key={p.id} href={`/app/ideas/${p.id}`} className="dmap-pin" aria-label={`Idea: ${p.title}`}>
                <title>{p.title}</title>
                <circle cx={x} cy={y} r={7} />
              </Link>
            );
          })}
        </svg>
        {tip && (
          <div className={`dmap-tip${flip ? ' flip' : ''}`} style={{ left: tip.x, top: tip.y }} role="status">
            <strong>{tip.name}</strong>
            <span className="dmap-total">{s?.total ?? 0} {(s?.total ?? 0) === 1 ? 'idea' : 'ideas'}</span>
            {pop ? <span className="dmap-pop">{rate(s?.total ?? 0, tip.name).toFixed(2)} per 10,000 people · population {pop.toLocaleString('en-GB')} (2011)</span> : null}
            {s && s.total > 0 && (
              <ul>
                {(Object.keys(STAGE_LABEL) as Stage[]).filter((k) => s.stages[k]).map((k) => (
                  <li key={k}><span className={`stage ${k}`}>{STAGE_LABEL[k]}</span><b>{s.stages[k]}</b></li>
                ))}
              </ul>
            )}
            {tip.pinned
              ? <button type="button" className="btn small" onClick={() => filter(tip.name)}>{selected === tip.name ? 'Show all districts' : `Show ideas in ${tip.name}`}</button>
              : <small>{selected === tip.name ? 'Click to show all districts' : 'Click to filter the table'}</small>}
          </div>
        )}
      </div>
    </div>
  );
}
