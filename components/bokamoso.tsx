import { useId } from 'react';

// Bokamoso ("the future" in Setswana), the portal guide. Drawn in code with separate parts
// so his eyes, hands and head can move. Modes are driven by what the user is doing.
export type BkMode = 'idle' | 'watch' | 'hide' | 'peek' | 'no' | 'yes' | 'wave';

const SKIN = '#8d5a3b';
const SHADE = '#74472d';
const HAIR = '#1f1410';

export default function Bokamoso({ mode = 'idle', look = 0, size = 96 }: { mode?: BkMode; look?: number; size?: number }) {
  const clip = useId();
  const lx = mode === 'watch' ? Math.max(-1, Math.min(1, look)) * 4 : 0;
  const ly = mode === 'watch' ? 3 : 0;
  return (
    <svg className="bk" data-mode={mode} viewBox="0 0 200 200" width={size} height={size} aria-hidden="true" focusable="false">
      <defs><clipPath id={clip}><circle cx="100" cy="100" r="100" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="100" cy="100" r="100" fill="#f6eeea" />
        {/* Maroon polo with orange and gold shoulders */}
        <path d="M26 200 Q28 152 70 142 L130 142 Q172 152 174 200 Z" fill="#7a1e1e" />
        <path d="M70 142 Q40 149 31 176 L48 181 Q56 158 84 150 Z" fill="#d2561f" />
        <path d="M130 142 Q160 149 169 176 L152 181 Q144 158 116 150 Z" fill="#d2561f" />
        <path d="M31 176 L48 181 L46 189 L29 185 Z" fill="#c6a218" />
        <path d="M169 176 L152 181 L154 189 L171 185 Z" fill="#c6a218" />
        <rect x="88" y="118" width="24" height="32" fill={SHADE} />
        <path d="M82 140 L100 162 L118 140 L112 136 L100 150 L88 136 Z" fill="#d2561f" />
        <image href="/ceda-mark.png" x="120" y="164" width="27" height="14" />
        <BkHead mode={mode} lx={lx} ly={ly} />
        {/* Hands that cover his eyes on password boxes */}
        <g className="bk-hand">
          <rect x="70" y="98" width="24" height="110" fill={SKIN} />
          <rect x="64" y="72" width="36" height="32" rx="12" fill={SKIN} stroke={SHADE} strokeWidth="1.5" />
          <path d="M73 76 V90 M82 75 V90 M91 76 V90" stroke={SHADE} strokeWidth="1.5" strokeLinecap="round" />
        </g>
        <g className="bk-hand">
          <rect x="106" y="98" width="24" height="110" fill={SKIN} />
          <rect x="100" y="72" width="36" height="32" rx="12" fill={SKIN} stroke={SHADE} strokeWidth="1.5" />
          <path d="M109 76 V90 M118 75 V90 M127 76 V90" stroke={SHADE} strokeWidth="1.5" strokeLinecap="round" />
        </g>
        {/* Thumbs up */}
        <g className="bk-thumb">
          <rect x="155" y="140" width="22" height="70" fill={SKIN} />
          <rect x="154" y="98" width="13" height="28" rx="6.5" fill={SKIN} stroke={SHADE} strokeWidth="1.5" />
          <rect x="150" y="118" width="31" height="28" rx="10" fill={SKIN} stroke={SHADE} strokeWidth="1.5" />
        </g>
        {/* Waving hand */}
        <g className="bk-wave">
          <rect x="156" y="112" width="20" height="96" fill={SKIN} />
          {[151, 158.5, 166, 173.5].map((x) => <rect key={x} x={x} y="66" width="6.5" height="24" rx="3.2" fill={SKIN} stroke={SHADE} strokeWidth="1" />)}
          <rect x="150" y="82" width="31" height="36" rx="11" fill={SKIN} stroke={SHADE} strokeWidth="1.5" />
        </g>
      </g>
    </svg>
  );
}

// Head, face and glasses, shared by the bust and the seated figure. Pupils follow the
// pointer through --ex/--ey (set by EyeTracker) unless a mode drives them directly.
export function BkHead({ mode, lx = 0, ly = 0 }: { mode: BkMode; lx?: number; ly?: number }) {
  const mouth = mode === 'yes' || mode === 'wave'
    ? <path d="M86 109 Q100 126 114 109 Z" fill="#fff" stroke={HAIR} strokeWidth="2" strokeLinejoin="round" />
    : <path d={mode === 'no' ? 'M90 116 Q100 109 110 116' : 'M89 111 Q100 120 111 111'} fill="none" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round" />;
  return (
        <g className="bk-head">
        <circle cx="62" cy="90" r="7" fill={SKIN} />
        <circle cx="138" cy="90" r="7" fill={SKIN} />
        <ellipse cx="100" cy="86" rx="38" ry="44" fill={SKIN} />
        {/* Short curly hair */}
        <ellipse cx="100" cy="53" rx="36" ry="16" fill={HAIR} />
        {[[66, 60], [75, 49], [88, 43], [100, 41], [112, 43], [125, 49], [134, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="10" fill={HAIR} />)}
        <path d="M76 74 Q84 70 92 74 M108 74 Q116 70 124 74" fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round" />
        <g className="bk-eyes">
          <ellipse cx="84" cy="88" rx="8" ry="7" fill="#fff" />
          <ellipse cx="116" cy="88" rx="8" ry="7" fill="#fff" />
          <g className="bk-pupils" style={mode === 'watch' ? { transform: `translate(${lx}px, ${ly}px)` } : undefined}>
            <circle cx="84" cy="88" r="3.6" fill={HAIR} />
            <circle cx="116" cy="88" r="3.6" fill={HAIR} />
          </g>
        </g>
        {/* Glasses */}
        <g fill="none" stroke={HAIR} strokeWidth="2.5">
          <rect x="71" y="77" width="26" height="22" rx="7" />
          <rect x="103" y="77" width="26" height="22" rx="7" />
          <path d="M97 86 H103 M71 86 L63 84 M129 86 L137 84" />
        </g>
        <path d="M100 96 Q96 104 101 105" fill="none" stroke={SHADE} strokeWidth="2.5" strokeLinecap="round" />
        {mouth}
      </g>
  );
}
