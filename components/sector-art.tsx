// Flat illustrated covers for community challenges without a photo, one scene per sector,
// drawn in CEDA colours in the same style as Bokamoso.

type Scene = { sky: string; hill: string; ground: string; sun: string; art: React.ReactNode };

const ink = '#3f2c24';
const cream = '#f6eeea';

const SCENES: Record<string, Scene> = {
  agriculture: {
    sky: '#c6a218', hill: '#b08e12', ground: '#7a5a12', sun: '#f6e6a6',
    art: (
      <g>
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${60 + i * 70} 420 Q${140 + i * 30} 330 ${200 + i * 6} 300`} stroke="#5e450d" strokeWidth="10" fill="none" opacity=".5" />)}
        <path d="M200 330 V210" stroke="#2f5d1e" strokeWidth="9" strokeLinecap="round" />
        <path d="M200 260 Q150 240 140 200 Q190 205 200 250 M200 235 Q250 210 262 170 Q210 178 200 225" fill="#3f7a28" />
        <ellipse cx="200" cy="205" rx="16" ry="26" fill="#e7c64a" />
      </g>
    ),
  },
  energy: {
    sky: '#d2561f', hill: '#b4471a', ground: '#7a2e12', sun: '#ffd27a',
    art: (
      <g>
        <path d="M120 300 L280 270 L300 360 L140 390 Z" fill={ink} />
        {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <path key={`${r}${c}`} d={`M${128 + c * 41 - r * 1} ${305 - c * 7.5 + r * 28} l38 -7 l6 25 l-38 7 z`} fill="#3b5b8f" />))}
        <path d="M210 385 V430 M180 430 h60" stroke={ink} strokeWidth="10" strokeLinecap="round" />
      </g>
    ),
  },
  water: {
    sky: '#3f2c24', hill: '#5a4136', ground: '#2b1d17', sun: '#e8834f',
    art: (
      <g>
        <path d="M170 410 L200 200 L230 410 M180 340 h40 M186 290 h28 M192 245 h16" stroke="#c9bcb5" strokeWidth="8" fill="none" strokeLinejoin="round" />
        <path d="M200 200 l-36 -8 a36 36 0 0 1 72 0 z" fill="#c9bcb5" />
        <path d="M280 330 q22 30 0 44 q-22 -14 0 -44 z M120 300 q16 22 0 32 q-16 -10 0 -32 z" fill="#7cc2e8" />
        <rect x="236" y="380" width="70" height="30" rx="8" fill="#7cc2e8" opacity=".8" />
      </g>
    ),
  },
  tourism: {
    sky: '#d2561f', hill: '#a8401a', ground: '#6b2a10', sun: '#ffd27a',
    art: (
      <g>
        <path d="M180 420 Q176 330 168 280 Q200 300 232 280 Q224 330 220 420 Z" fill="#8a6a55" />
        <path d="M168 282 Q130 250 112 214 M176 278 Q170 230 182 200 M200 290 Q206 240 230 214 M226 282 Q262 252 286 232" stroke="#8a6a55" strokeWidth="10" strokeLinecap="round" fill="none" />
        {[[112, 206], [182, 192], [232, 204], [290, 224], [150, 230], [262, 236]].map(([x, y]) => <ellipse key={x} cx={x} cy={y} rx="30" ry="16" fill="#3f7a28" />)}
      </g>
    ),
  },
  environment: {
    sky: '#7a1e1e', hill: '#5c1515', ground: '#3d0e0e', sun: '#e8834f',
    art: (
      <g>
        <path d="M200 400 Q110 330 150 230 Q200 180 280 200 Q300 300 200 400 Z" fill="#3f7a28" />
        <path d="M200 400 Q210 300 260 220" stroke="#2f5d1e" strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M120 400 a80 80 0 0 1 20 -60 M300 330 a80 80 0 0 1 -10 70" stroke={cream} strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M132 334 l10 6 l-12 4 z M296 402 l-10 -4 l10 -6 z" fill={cream} />
      </g>
    ),
  },
  manufacturing: {
    sky: '#3f2c24', hill: '#5a4136', ground: '#2b1d17', sun: '#c6a218',
    art: (
      <g>
        <path d="M100 420 V310 l60 -40 v40 l60 -40 v40 l60 -40 V420 Z" fill="#c9bcb5" />
        <rect x="270" y="210" width="26" height="110" fill="#c9bcb5" />
        <circle cx="290" cy="190" r="16" fill={cream} opacity=".5" />
        <circle cx="306" cy="164" r="22" fill={cream} opacity=".35" />
        {[0, 1, 2].map((i) => <rect key={i} x={122 + i * 60} y="350" width="30" height="24" rx="4" fill="#d2561f" />)}
      </g>
    ),
  },
  food: {
    sky: '#c6a218', hill: '#b08e12', ground: '#7a5a12', sun: '#fff1c2',
    art: (
      <g>
        <path d="M130 300 h140 l-14 110 h-112 z" fill="#d2561f" />
        <rect x="120" y="282" width="160" height="22" rx="8" fill="#7a1e1e" />
        <path d="M170 270 q-10 -26 6 -46 M200 270 q-10 -30 8 -54 M230 270 q-10 -26 6 -46" stroke={cream} strokeWidth="6" fill="none" strokeLinecap="round" opacity=".8" />
        <rect x="160" y="330" width="80" height="30" rx="6" fill={cream} opacity=".85" />
      </g>
    ),
  },
  education: {
    sky: '#7a1e1e', hill: '#5c1515', ground: '#3d0e0e', sun: '#c6a218',
    art: (
      <g>
        <path d="M200 300 Q150 280 100 290 V400 Q150 390 200 410 Q250 390 300 400 V290 Q250 280 200 300 Z" fill={cream} />
        <path d="M200 300 V410" stroke="#c9bcb5" strokeWidth="4" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M118 ${312 + i * 20} Q150 ${304 + i * 20} 186 ${314 + i * 20} M214 ${314 + i * 20} Q250 ${304 + i * 20} 282 ${312 + i * 20}`} stroke="#c9bcb5" strokeWidth="3" fill="none" />)}
        <path d="M150 240 l50 -24 l50 24 l-50 24 z" fill={ink} />
        <path d="M250 240 v26" stroke="#c6a218" strokeWidth="4" />
      </g>
    ),
  },
  technology: {
    sky: '#3f2c24', hill: '#5a4136', ground: '#2b1d17', sun: '#d2561f',
    art: (
      <g>
        <rect x="150" y="210" width="100" height="190" rx="16" fill={ink} stroke="#c9bcb5" strokeWidth="6" />
        <rect x="160" y="228" width="80" height="140" rx="6" fill="#d2561f" />
        <path d="M176 300 l16 16 l32 -36" stroke={cream} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M110 250 a110 110 0 0 1 0 100 M290 250 a110 110 0 0 0 0 100" stroke="#c6a218" strokeWidth="6" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  health: {
    sky: '#7a1e1e', hill: '#5c1515', ground: '#3d0e0e', sun: '#e8834f',
    art: <path d="M200 410 Q100 340 110 270 Q120 220 165 225 Q190 230 200 260 Q210 230 235 225 Q280 220 290 270 Q300 340 200 410 Z M188 290 h24 v24 h24 v24 h-24 v24 h-24 v-24 h-24 v-24 h24 z" fill={cream} fillRule="evenodd" />,
  },
  transport: {
    sky: '#d2561f', hill: '#a8401a', ground: '#6b2a10', sun: '#ffd27a',
    art: (
      <g>
        <rect x="90" y="300" width="150" height="80" rx="8" fill={cream} />
        <path d="M240 320 h50 l30 34 v26 h-80 z" fill="#c6a218" />
        <rect x="256" y="328" width="30" height="20" rx="3" fill="#7cc2e8" />
        {[130, 210, 290].map((x) => <circle key={x} cx={x} cy="386" r="18" fill={ink} stroke="#c9bcb5" strokeWidth="5" />)}
      </g>
    ),
  },
  finance: {
    sky: '#c6a218', hill: '#b08e12', ground: '#7a5a12', sun: '#fff1c2',
    art: (
      <g>
        {[0, 1, 2, 3].map((i) => <ellipse key={i} cx="170" cy={392 - i * 22} rx="56" ry="16" fill={i % 2 ? '#e7c64a' : '#d8b13a'} stroke="#7a5a12" strokeWidth="3" />)}
        <circle cx="262" cy="300" r="50" fill="#e7c64a" stroke="#7a5a12" strokeWidth="5" />
        <text x="262" y="318" textAnchor="middle" fontSize="48" fontWeight="700" fill="#7a5a12">P</text>
      </g>
    ),
  },
  other: {
    sky: '#7a1e1e', hill: '#5c1515', ground: '#3d0e0e', sun: '#c6a218',
    art: (
      <g>
        <path d="M200 210 a70 70 0 0 0 -44 124 c10 9 14 20 14 32 h60 c0 -12 4 -23 14 -32 a70 70 0 0 0 -44 -124 z" fill="#ffd27a" />
        <rect x="172" y="372" width="56" height="14" rx="5" fill="#c9bcb5" />
        <rect x="178" y="392" width="44" height="12" rx="5" fill="#c9bcb5" />
        {[[200, 170], [128, 210], [272, 210], [104, 286], [296, 286]].map(([x, y]) => <circle key={x + y} cx={x} cy={y} r="6" fill="#ffd27a" opacity=".7" />)}
      </g>
    ),
  },
};

const KEY: [RegExp, string][] = [
  [/agri|farm|crop|cattle|livestock/i, 'agriculture'], [/energy|solar|power|electric/i, 'energy'], [/water|borehole|sanitation/i, 'water'],
  [/touris|craft|culture/i, 'tourism'], [/environment|waste|recycl|climate/i, 'environment'], [/manufactur|industry|textile/i, 'manufacturing'],
  [/food|process/i, 'food'], [/educat|school|skill/i, 'education'], [/tech|digital|ict|software/i, 'technology'], [/health|clinic|medic/i, 'health'],
  [/transport|logistic|road/i, 'transport'], [/financ|bank|money/i, 'finance'],
];
export const sectorKey = (sector: string | null | undefined) => KEY.find(([re]) => re.test(sector ?? ''))?.[1] ?? 'other';

export default function SectorArt({ sector, className = '' }: { sector: string | null | undefined; className?: string }) {
  const s = SCENES[sectorKey(sector)];
  return (
    <svg className={`sector-art ${className}`} viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="500" fill={s.sky} />
      <circle cx="310" cy="110" r="46" fill={s.sun} opacity=".9" className="sa-sun" />
      <path d="M0 360 Q100 300 200 340 T400 320 V500 H0 Z" fill={s.hill} />
      <path d="M0 420 Q120 380 240 420 T400 410 V500 H0 Z" fill={s.ground} />
      <g className="sa-art">{s.art}</g>
    </svg>
  );
}
