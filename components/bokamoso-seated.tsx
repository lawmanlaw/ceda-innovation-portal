'use client';
import { useEffect, useState } from 'react';
import { BkHead } from '@/components/bokamoso';

// Bokamoso in his CEDA-orange chair with his laptop. Every few seconds he does something:
// stretches, cheers you on, waves, stands up for a hop, nods or gives a thumbs up, then goes
// back to typing. Eyes follow the pointer (EyeTracker). Reduced motion keeps him still.
const SKIN = '#8d5a3b';
const SHADE = '#74472d';
const POLO = '#7a1e1e';

export type Act = 'type' | 'stretch' | 'cheer' | 'wave' | 'stand' | 'nod' | 'thumbs';
const SAYS: Record<Act, string[]> = {
  type: ['Dumela!', 'Hi there!'],
  stretch: ['Aah, stretch!', 'Big stretch!'],
  cheer: ['You got this!', 'Go for it!', 'Keep going!'],
  wave: ['Dumela!', 'Hello!'],
  stand: ["Let's go!", 'Up we go!'],
  nod: ['Nice work', 'Looking good'],
  thumbs: ['Great idea!', 'Well done!'],
};
const ACTS: Act[] = ['stretch', 'cheer', 'wave', 'stand', 'nod', 'thumbs'];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function BokamosoSeated({ say, size = 180, pose }: { say?: string; size?: number; pose?: Act }) {
  const [act, setAct] = useState<Act>(pose ?? 'type');
  const [line, setLine] = useState(say ?? 'Dumela!');

  useEffect(() => {
    if (pose || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t: ReturnType<typeof setTimeout>;
    const next = (current: Act) => {
      const resting = current !== 'type';
      t = setTimeout(() => {
        const a: Act = resting ? 'type' : pick(ACTS.filter((x) => x !== current));
        setAct(a);
        setLine(a === 'type' ? (say ?? pick(SAYS.type)) : pick(SAYS[a]));
        next(a);
      }, resting ? 2600 : 5000 + Math.random() * 5000);
    };
    next('type');
    return () => clearTimeout(t);
  }, [say, pose]);

  return (
    <svg className="bk bk-seated" data-mode="idle" data-act={act} viewBox="0 0 230 240" width={size} height={(size * 240) / 230} role="img" aria-label={`Bokamoso, your guide, says ${line}`}>
      <g className="bk-bubble">
        <path d="M140 12 h76 a12 12 0 0 1 12 12 v22 a12 12 0 0 1 -12 12 h-46 l-12 12 v-12 h-18 a12 12 0 0 1 -12 -12 v-22 a12 12 0 0 1 12 -12 z" fill="#fff" stroke="#e8d9d2" strokeWidth="1.5" />
        <text key={line} x="178" y="40" textAnchor="middle" fontSize={line.length > 11 ? 12 : 14} fontWeight="700" fill={POLO} className="bk-line">{line}</text>
      </g>
      {/* Chair */}
      <ellipse cx="108" cy="228" rx="86" ry="9" fill="#3f2c24" opacity=".12" />
      <path d="M30 150 Q22 92 70 86 Q112 82 122 130 L126 190 Q130 222 96 224 L52 224 Q24 220 26 190 Z" fill="#b4471a" />
      <path d="M36 190 Q30 160 62 154 L160 158 Q190 162 186 196 Q182 222 150 224 L64 224 Q38 222 36 190 Z" fill="#d2561f" />
      <path d="M48 168 Q92 162 150 168" fill="none" stroke="#e8834f" strokeWidth="4" strokeLinecap="round" opacity=".6" />

      {/* Legs: seated, or standing in front of the chair */}
      <g className="bk-legs-sit">
        <path d="M84 168 L150 166 Q164 166 164 180 L164 184 L92 188 Z" fill="#2b211c" />
        <path d="M146 172 h18 l6 44 h-20 z" fill="#2b211c" />
        <path d="M146 214 h26 q10 0 10 8 v4 h-36 z" fill="#1f1410" />
      </g>
      <g className="bk-legs-stand">
        <path d="M88 150 h20 l-2 74 h-16 z M114 150 h20 l-4 74 h-16 z" fill="#2b211c" />
        <path d="M84 222 h26 q6 0 6 6 v2 h-34 z M110 222 h26 q6 0 6 6 v2 h-34 z" fill="#1f1410" />
      </g>

      <g className="bk-body">
        <g className="bk-breathe">
          {/* Torso: maroon polo, orange shoulders, gold trim */}
          <path d="M78 118 Q76 110 92 106 L120 106 Q136 110 134 120 L132 176 L82 178 Z" fill={POLO} />
          <path d="M78 118 Q76 108 94 106 L98 120 Q86 124 84 140 L74 138 Q72 124 78 118 Z" fill="#d2561f" />
          <path d="M134 120 Q136 108 118 106 L114 120 Q126 124 128 140 L138 138 Q140 124 134 120 Z" fill="#d2561f" />
          <path d="M74 138 L84 140 L84 145 L73 143 Z M128 140 L138 138 L139 143 L128 145 Z" fill="#c6a218" />
          <path d="M98 106 L106 118 L114 106 L111 104 L106 112 L101 104 Z" fill="#d2561f" />
          <image href="/ceda-mark.png" x="114" y="128" width="14" height="7" />
          <rect x="99" y="96" width="14" height="14" fill={SHADE} />
          <g className="bk-headwrap"><g transform="translate(51 26) scale(.55)"><BkHead mode={act === 'cheer' || act === 'thumbs' || act === 'wave' ? 'yes' : 'idle'} /></g></g>
        </g>

        {/* Laptop and typing arms */}
        <g className="bk-laptop">
          <path d="M120 128 L170 120 L176 162 L126 168 Z" fill="#3f2c24" />
          <path d="M124 132 L166 125 L171 158 L129 163 Z" fill="#5a4136" />
          <image href="/ceda-mark.png" x="138" y="136" width="18" height="9" opacity=".9" />
          <path d="M100 168 L178 160 L182 166 L102 176 Z" fill="#c9bcb5" />
        </g>
        <g className="bk-arms bk-arms-type">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M128 142 Q132 160 140 164" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
          <circle className="bk-tap1" cx="124" cy="166" r="5.5" fill={SKIN} />
          <circle className="bk-tap2" cx="142" cy="165" r="5" fill={SKIN} />
        </g>
        {/* Both arms up: stretch and cheer */}
        <g className="bk-arms bk-arms-up">
          <path d="M84 126 Q64 100 70 58" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M128 126 Q148 100 142 58" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="70" cy="52" r="7" fill={SKIN} />
          <circle cx="142" cy="52" r="7" fill={SKIN} />
        </g>
        {/* One arm waving */}
        <g className="bk-arms bk-arms-wave">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="124" cy="166" r="5.5" fill={SKIN} />
          <g className="bk-waver">
            <path d="M128 126 Q150 110 150 80" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
            <path d="M143 74 v-12 M148 72 v-14 M153 72 v-14 M158 74 v-10" stroke={SKIN} strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="150" cy="76" r="8" fill={SKIN} />
          </g>
        </g>
        {/* Thumbs up */}
        <g className="bk-arms bk-arms-thumbs">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="124" cy="166" r="5.5" fill={SKIN} />
          <path d="M128 128 Q152 124 156 100" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
          <rect x="148" y="86" width="16" height="16" rx="6" fill={SKIN} />
          <rect x="152" y="72" width="7" height="16" rx="3.5" fill={SKIN} />
        </g>
        {/* Arms by his sides when standing */}
        <g className="bk-arms bk-arms-down">
          <path d="M82 124 Q76 150 82 172" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M130 124 Q136 150 130 172" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="82" cy="176" r="6" fill={SKIN} />
          <circle cx="130" cy="176" r="6" fill={SKIN} />
        </g>
      </g>
      {/* Sparkles when cheering */}
      <g className="bk-sparks" fill="#c6a218">
        <path d="M44 50 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" />
        <path d="M176 92 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" />
        <path d="M30 104 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
      </g>
    </svg>
  );
}
