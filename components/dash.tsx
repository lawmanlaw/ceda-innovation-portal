import Link from 'next/link';
import Icon, { type IconName } from '@/components/icon';

// Building blocks for the dashboards: coloured tiles with a progress ring, stat tiles,
// a weekly activity chart and a "next steps" list.

const TONES = ['maroon', 'orange', 'gold', 'brown'] as const;
export type Tone = (typeof TONES)[number];
export const tone = (i: number): Tone => TONES[i % TONES.length];

export function Ring({ pct, light = true }: { pct: number; light?: boolean }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <svg className={`dring${light ? ' light' : ''}`} viewBox="0 0 64 64" role="img" aria-label={`${p}%`}>
      <circle cx="32" cy="32" r="26" />
      <circle cx="32" cy="32" r="26" pathLength={100} style={{ strokeDasharray: `${p} 100` }} />
      <text x="32" y="37" textAnchor="middle">{p}%</text>
    </svg>
  );
}

export function Tile({ href, title, sub, pct, icon, t }: { href: string; title: string; sub: string; pct: number; icon: IconName; t: Tone }) {
  return (
    <Link href={href} className={`dtile ${t}`}>
      <strong>{title}</strong>
      <span>{sub}</span>
      <Ring pct={pct} />
      <span className="dtile-art" aria-hidden="true"><Icon name={icon} still /></span>
    </Link>
  );
}

export function Stat({ label, value }: { label: string; value: number | string }) {
  return <div className="dstat"><span>{label}</span><strong><i aria-hidden="true" />{typeof value === 'number' && value < 10 ? `0${value}` : value}</strong></div>;
}

// Seven bars for the last seven days, today on the right
export function Activity({ title, dates }: { title: string; dates: (string | null | undefined)[] }) {
  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date(Date.now() - (6 - k) * 86400000);
    return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Africa/Gaborone' }) };
  });
  const counts = days.map((d) => dates.filter((x) => x?.slice(0, 10) === d.key).length);
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  return (
    <section className="dactivity" aria-label={`${title}, last 7 days`}>
      <div className="row between"><h2>{title}</h2><span className="muted">Last 7 days</span></div>
      <div className="dbars">
        {days.map((d, k) => (
          <div key={d.key} className="dbar">
            <span style={{ height: `${Math.max(6, (counts[k] / max) * 100)}%` }} className={k === peak && counts[k] ? 'peak' : ''} title={`${counts[k]} on ${d.label}`} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export type Step = { href: string; icon: IconName; title: string; sub: string; t: Tone };
export function Steps({ items, empty }: { items: Step[]; empty: string }) {
  if (!items.length) return <p className="muted">{empty}</p>;
  return (
    <div className="dsteps">
      {items.map((s, k) => (
        <Link key={k} href={s.href} className="dstep">
          <span className={`dstep-ico ${s.t}`}><Icon name={s.icon} still /></span>
          <span><strong>{s.title}</strong><small>{s.sub}</small></span>
          <span className="dstep-go" aria-hidden="true">›</span>
        </Link>
      ))}
    </div>
  );
}
