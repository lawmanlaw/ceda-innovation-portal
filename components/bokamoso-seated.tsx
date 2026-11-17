'use client';
import { useEffect, useState } from 'react';
import { BkHead } from '@/components/bokamoso';

// Bokamoso in his CEDA-orange chair. Every few seconds he does something fun: dances,
// jumps with confetti, juggles, gets a bright idea, sips coffee, waves or stretches,
// then goes back to typing. Eyes follow the pointer. Reduced motion keeps him still.
const SKIN = '#8d5a3b';
const SHADE = '#74472d';
const POLO = '#7a1e1e';

export type Act = 'type' | 'dance' | 'jump' | 'juggle' | 'idea' | 'coffee' | 'wave' | 'stretch';
const SAYS: Record<Act, string[]> = {
  type: ['Dumela!', 'Hi there!'],
  dance: ['Dance break!', 'Feel the beat!'],
  jump: ['Woohoo!', 'Yes yes yes!'],
  juggle: ['Watch this!', 'Ta-da!'],
  idea: ['Aha! An idea!', 'Eureka!'],
  coffee: ['Coffee time', 'Mmm, coffee'],
  wave: ['Dumela!', 'Hello!'],
  stretch: ['Big stretch!', 'Aaah!'],
};
const ACTS: Act[] = ['dance', 'jump', 'juggle', 'idea', 'coffee', 'wave', 'stretch'];
const HAPPY: Act[] = ['dance', 'jump', 'juggle', 'idea', 'wave'];
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
        const a: Act = resting ? 'type' : pick(ACTS);
        setAct(a);
        setLine(a === 'type' ? (say ?? pick(SAYS.type)) : pick(SAYS[a]));
        next(a);
      }, resting ? 3400 : 4000 + Math.random() * 4000);
    };
    next('type');
    return () => clearTimeout(t);
  }, [say, pose]);

  return (
    <svg className="bk bk-seated" data-mode="idle" data-act={act} viewBox="0 0 230 240" width={size} height={(size * 240) / 230} role="img" aria-label={`Bokamoso, your guide, says ${line}`}>
      <g className="bk-bubble">
        <path d="M140 12 h76 a12 12 0 0 1 12 12 v22 a12 12 0 0 1 -12 12 h-46 l-12 12 v-12 h-18 a12 12 0 0 1 -12 -12 v-22 a12 12 0 0 1 12 -12 z" fill="#fff" stroke="#e8d9d2" strokeWidth="1.5" />
        <text key={line} x="178" y="40" textAnchor="middle" fontSize={line.length > 11 ? 11.5 : 14} fontWeight="700" fill={POLO} className="bk-line">{line}</text>
      </g>
      {/* Chair */}
      <ellipse cx="108" cy="228" rx="86" ry="9" fill="#3f2c24" opacity=".12" />
      <path d="M30 150 Q22 92 70 86 Q112 82 122 130 L126 190 Q130 222 96 224 L52 224 Q24 220 26 190 Z" fill="#b4471a" />
      <path d="M36 190 Q30 160 62 154 L160 158 Q190 162 186 196 Q182 222 150 224 L64 224 Q38 222 36 190 Z" fill="#d2561f" />
      <path d="M48 168 Q92 162 150 168" fill="none" stroke="#e8834f" strokeWidth="4" strokeLinecap="round" opacity=".6" />

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
          <path d="M78 118 Q76 110 92 106 L120 106 Q136 110 134 120 L132 176 L82 178 Z" fill={POLO} />
          <path d="M78 118 Q76 108 94 106 L98 120 Q86 124 84 140 L74 138 Q72 124 78 118 Z" fill="#d2561f" />
          <path d="M134 120 Q136 108 118 106 L114 120 Q126 124 128 140 L138 138 Q140 124 134 120 Z" fill="#d2561f" />
          <path d="M74 138 L84 140 L84 145 L73 143 Z M128 140 L138 138 L139 143 L128 145 Z" fill="#c6a218" />
          <path d="M98 106 L106 118 L114 106 L111 104 L106 112 L101 104 Z" fill="#d2561f" />
          <image href="/ceda-mark.png" x="114" y="128" width="14" height="7" />
          <rect x="99" y="96" width="14" height="14" fill={SHADE} />
          <g className="bk-headwrap"><g transform="translate(51 26) scale(.55)"><BkHead mode={HAPPY.includes(act) ? 'yes' : 'idle'} /></g></g>
        </g>

        <g className="bk-laptop">
          <path d="M120 128 L170 120 L176 162 L126 168 Z" fill="#3f2c24" />
          <path d="M124 132 L166 125 L171 158 L129 163 Z" fill="#5a4136" />
          <image href="/ceda-mark.png" x="138" y="136" width="18" height="9" opacity=".9" />
          <path d="M100 168 L178 160 L182 166 L102 176 Z" fill="#c9bcb5" />
        </g>
        {/* Typing */}
        <g className="bk-arms bk-arms-type">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M128 142 Q132 160 140 164" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
          <circle className="bk-tap1" cx="124" cy="166" r="5.5" fill={SKIN} />
          <circle className="bk-tap2" cx="142" cy="165" r="5" fill={SKIN} />
        </g>
        {/* Both arms up: stretch, jump, juggle */}
        <g className="bk-arms bk-arms-up">
          <path d="M84 126 Q64 100 70 58" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M128 126 Q148 100 142 58" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="70" cy="52" r="7" fill={SKIN} />
          <circle cx="142" cy="52" r="7" fill={SKIN} />
        </g>
        {/* Dance: one arm up, one out, see-sawing */}
        <g className="bk-arms bk-arms-dance">
          <path d="M84 126 Q62 108 58 78" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <path d="M128 128 Q152 136 162 156" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="58" cy="72" r="7" fill={SKIN} />
          <circle cx="164" cy="160" r="7" fill={SKIN} />
        </g>
        {/* Wave */}
        <g className="bk-arms bk-arms-wave">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="124" cy="166" r="5.5" fill={SKIN} />
          <g className="bk-waver">
            <path d="M128 126 Q150 110 150 80" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
            <path d="M143 74 v-12 M148 72 v-14 M153 72 v-14 M158 74 v-10" stroke={SKIN} strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="150" cy="76" r="8" fill={SKIN} />
          </g>
        </g>
        {/* Coffee sip */}
        <g className="bk-arms bk-arms-coffee">
          <path d="M84 140 Q86 166 108 168 L122 166" fill="none" stroke={POLO} strokeWidth="11" strokeLinecap="round" />
          <circle cx="124" cy="166" r="5.5" fill={SKIN} />
          <g className="bk-sip">
            <path d="M128 128 Q154 124 134 98" fill="none" stroke={POLO} strokeWidth="10" strokeLinecap="round" />
            <path d="M136 86 h8 a5 5 0 0 1 0 10 h-8" fill="none" stroke="#c6a218" strokeWidth="3" />
            <rect x="120" y="82" width="17" height="17" rx="3" fill="#c6a218" />
            <circle cx="133" cy="99" r="5.5" fill={SKIN} />
            <path className="bk-steam" d="M125 78 q-3 -5 0 -9 q3 -4 0 -8 M132 78 q-3 -5 0 -9 q3 -4 0 -8" fill="none" stroke="#c9bcb5" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>
      </g>

      {/* Bright idea */}
      <g className="bk-fx bk-bulb">
        <path d="M62 10 v-8 M38 22 l-7 -5 M86 22 l7 -5 M34 44 h-8 M90 44 h8" stroke="#c6a218" strokeWidth="3" strokeLinecap="round" />
        <path d="M62 18 a17 17 0 0 0 -10 31 q3 3 3 7 h14 q0 -4 3 -7 a17 17 0 0 0 -10 -31 z" fill="#ffd27a" stroke="#c6a218" strokeWidth="2" />
        <rect x="55" y="58" width="14" height="6" rx="2" fill="#c9bcb5" />
      </g>
      {/* Juggling balls */}
      <g className="bk-fx bk-balls">
        <circle cx="70" cy="18" r="7" fill="#d2561f" />
        <circle cx="70" cy="18" r="7" fill="#c6a218" />
        <circle cx="70" cy="18" r="7" fill="#7a1e1e" />
      </g>
      {/* Music notes */}
      <g className="bk-fx bk-notes" fill={POLO} stroke={POLO} strokeWidth="2.5" strokeLinecap="round">
        <g><ellipse cx="34" cy="70" rx="5" ry="3.6" /><path d="M39 70 v-16 l8 3" fill="none" /></g>
        <g><ellipse cx="180" cy="110" rx="5" ry="3.6" /><path d="M185 110 v-16 l8 3" fill="none" /></g>
        <g><ellipse cx="20" cy="120" rx="4" ry="3" /><path d="M24 120 v-13" fill="none" /></g>
      </g>
      {/* Confetti */}
      <g className="bk-fx bk-confetti">
        {[[30, '#d2561f'], [58, '#c6a218'], [86, '#7a1e1e'], [120, '#e8834f'], [150, '#c6a218'], [178, '#d2561f'], [44, '#7a1e1e'], [136, '#d2561f']].map(([x, c], i) => (
          <rect key={i} x={x as number} y={-6} width="7" height="11" rx="2" fill={c as string} style={{ animationDelay: `${i * 110}ms` }} />
        ))}
      </g>
    </svg>
  );
}
