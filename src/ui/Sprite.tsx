import type { Level, ReactionType } from '../engine/data';

type Family = 'metal' | 'slime' | 'shell' | 'cloud' | 'crystal' | 'flame' | 'lattice';

const FAMILY_OF: Record<ReactionType, Family> = {
  置换: 'metal',
  氧化还原: 'metal',
  中和: 'slime',
  沉淀: 'shell',
  产气: 'cloud',
  分解: 'crystal',
  化合: 'flame',
  燃烧: 'flame',
  复分解: 'lattice',
};

const PALETTE: Record<Family, { dark: string; light: string; glow: string }> = {
  metal: { dark: '#54687d', light: '#a9bed3', glow: 'rgba(169, 190, 211, 0.45)' },
  slime: { dark: '#1f7a52', light: '#7ee0a0', glow: 'rgba(126, 224, 160, 0.45)' },
  shell: { dark: '#8a5a33', light: '#e6bd8c', glow: 'rgba(230, 189, 140, 0.45)' },
  cloud: { dark: '#2f6f9e', light: '#a8e0ff', glow: 'rgba(168, 224, 255, 0.45)' },
  crystal: { dark: '#4b34a8', light: '#c3a6ff', glow: 'rgba(195, 166, 255, 0.5)' },
  flame: { dark: '#b23a1e', light: '#ffc46b', glow: 'rgba(255, 196, 107, 0.5)' },
  lattice: { dark: '#1a6f68', light: '#6ff0e0', glow: 'rgba(111, 240, 224, 0.45)' },
};

export function familyOf(level: Level): Family {
  const first = level.enemy.weakness[0] as ReactionType | undefined;
  return (first && FAMILY_OF[first]) || 'lattice';
}

function Eyes({ cx, cy, gap = 26, r = 7 }: { cx: number; cy: number; gap?: number; r?: number }) {
  return (
    <g>
      <circle cx={cx - gap / 2} cy={cy} r={r} fill="#f7fbff" />
      <circle cx={cx + gap / 2} cy={cy} r={r} fill="#f7fbff" />
      <circle cx={cx - gap / 2 + 1} cy={cy + 1} r={r * 0.45} fill="#10161f" />
      <circle cx={cx + gap / 2 + 1} cy={cy + 1} r={r * 0.45} fill="#10161f" />
    </g>
  );
}

/** 敌人形象：按弱点类型给不同的剪影，颜色带一点按关卡变化的色相偏移 */
export function EnemySprite({ level, className = '' }: { level: Level; className?: string }) {
  const family = familyOf(level);
  const p = PALETTE[family];
  const uid = `e${level.id}`;
  const grad = (
    <defs>
      <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stopColor={p.light} />
        <stop offset="100%" stopColor={p.dark} />
      </linearGradient>
      <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={p.glow} />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
  );

  const shapes: Record<Family, React.ReactNode> = {
    metal: (
      <g>
        <polygon points="80,18 132,48 132,112 80,142 28,112 28,48" fill={`url(#${uid}-body)`} stroke="#0b1119" strokeWidth="3" />
        <polygon points="80,18 132,48 80,78 28,48" fill="#ffffff" opacity="0.1" />
        <polygon points="80,34 118,55 118,105 80,126 42,105 42,55" fill="none" stroke={p.light} strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="80" cy="52" r="4" fill={p.light} opacity="0.8" />
        <circle cx="80" cy="108" r="4" fill={p.light} opacity="0.8" />
        <Eyes cx={80} cy={74} gap={34} r={8} />
        <path d="M66 96 Q80 104 94 96" stroke="#10161f" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    ),
    slime: (
      <g>
        <path
          d="M30 108 C30 60 56 40 80 40 C104 40 130 60 130 108 C130 124 112 134 80 134 C48 134 30 124 30 108 Z"
          fill={`url(#${uid}-body)`}
          stroke="#0b1119"
          strokeWidth="3"
        />
        <ellipse cx="62" cy="74" rx="14" ry="9" fill="#ffffff" opacity="0.28" transform="rotate(-18 62 74)" />
        <path d="M44 126 q10 12 20 0 q10 12 20 0 q10 12 20 0 q8 10 14 -2" fill={p.dark} opacity="0.55" />
        <Eyes cx={80} cy={92} gap={36} r={9} />
      </g>
    ),
    shell: (
      <g>
        <path d="M22 118 C22 66 46 34 80 34 C114 34 138 66 138 118 Z" fill={`url(#${uid}-body)`} stroke="#0b1119" strokeWidth="3" />
        <path d="M40 116 C42 78 58 54 80 54 C102 54 118 78 120 116" fill="none" stroke={p.light} strokeOpacity="0.5" strokeWidth="3" />
        <path d="M60 116 C62 88 70 70 80 70 C90 70 98 88 100 116" fill="none" stroke={p.light} strokeOpacity="0.35" strokeWidth="2" />
        <Eyes cx={80} cy={98} gap={30} r={7} />
        <path d="M34 118 h92" stroke="#0b1119" strokeWidth="4" strokeLinecap="round" />
      </g>
    ),
    cloud: (
      <g>
        <g fill="#0b1119" transform="translate(80 82) scale(1.09) translate(-80 -82)">
          <circle cx="56" cy="80" r="30" />
          <circle cx="104" cy="80" r="30" />
          <circle cx="80" cy="56" r="28" />
          <circle cx="80" cy="104" r="26" />
        </g>
        <g fill={`url(#${uid}-body)`}>
          <circle cx="56" cy="80" r="30" />
          <circle cx="104" cy="80" r="30" />
          <circle cx="80" cy="56" r="28" />
          <circle cx="80" cy="104" r="26" />
        </g>
        <circle cx="62" cy="58" r="10" fill="#ffffff" opacity="0.28" />
        <Eyes cx={80} cy={84} gap={32} r={8} />
        <circle cx="34" cy="112" r="7" fill={p.light} opacity="0.45" />
        <circle cx="128" cy="118" r="5" fill={p.light} opacity="0.35" />
      </g>
    ),
    crystal: (
      <g>
        <polygon points="80,16 126,66 106,138 54,138 34,66" fill={`url(#${uid}-body)`} stroke="#0b1119" strokeWidth="3" />
        <polygon points="80,16 80,138 54,138 34,66" fill="#ffffff" opacity="0.1" />
        <polygon points="80,42 106,74 80,110 54,74" fill={p.dark} opacity="0.55" stroke={p.light} strokeOpacity="0.4" strokeWidth="2" />
        <Eyes cx={80} cy={78} gap={26} r={6.5} />
      </g>
    ),
    flame: (
      <g>
        <path
          d="M80 12 C96 44 128 56 128 92 C128 120 106 140 80 140 C54 140 32 120 32 92 C32 70 48 58 56 44 C60 66 70 74 78 76 C72 56 74 30 80 12 Z"
          fill={`url(#${uid}-body)`}
          stroke="#0b1119"
          strokeWidth="3"
        />
        <path d="M80 70 C88 86 100 94 100 108 C100 122 90 130 80 130 C70 130 60 122 60 108 C60 96 70 88 80 70 Z" fill="#ffe9b0" opacity="0.55" />
        <Eyes cx={80} cy={104} gap={26} r={6} />
      </g>
    ),
    lattice: (
      <g>
        <g transform="rotate(45 80 80)">
          <rect x="33" y="33" width="94" height="94" rx="14" fill={`url(#${uid}-body)`} stroke="#0b1119" strokeWidth="3" />
          <rect x="47" y="47" width="66" height="66" rx="8" fill="none" stroke={p.light} strokeOpacity="0.45" strokeWidth="2" />
          <rect x="61" y="61" width="38" height="38" rx="5" fill={p.dark} opacity="0.6" stroke={p.light} strokeOpacity="0.5" strokeWidth="2" />
          <path d="M80 33 V127 M33 80 H127" stroke={p.light} strokeOpacity="0.22" strokeWidth="2" />
        </g>
        <Eyes cx={80} cy={80} gap={22} r={6} />
      </g>
    ),
  };

  return (
    <div className={`sprite ${className}`} aria-hidden="true">
      <div className="sprite-glow" style={{ background: `radial-gradient(circle, ${p.glow}, transparent 70%)` }} />
      <svg viewBox="0 0 160 160" className="sprite-svg">
        {grad}
        {shapes[family]}
      </svg>
    </div>
  );
}

/** 玩家形象：配方师 —— 护目镜 + 白大褂 + 手里的锥形瓶 */
export function PlayerSprite({ className = '' }: { className?: string }) {
  return (
    <div className={`sprite player-sprite ${className}`} aria-hidden="true">
      <div className="sprite-glow player-glow" />
      <svg viewBox="0 0 120 140" className="sprite-svg">
        <defs>
          <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dfeaf7" />
            <stop offset="100%" stopColor="#9fb0c6" />
          </linearGradient>
        </defs>
        {/* 身体 / 白大褂 */}
        <path d="M38 138 V96 C38 78 50 68 60 68 C70 68 82 78 82 96 V138 Z" fill="url(#coat)" stroke="#0b1119" strokeWidth="3" />
        <path d="M60 68 V138" stroke="#8fa2b8" strokeWidth="2" opacity="0.7" />
        {/* 头 */}
        <circle cx="60" cy="44" r="22" fill="#f2d3b3" stroke="#0b1119" strokeWidth="3" />
        {/* 护目镜 */}
        <rect x="40" y="34" width="40" height="16" rx="8" fill="#1b2836" stroke="#0b1119" strokeWidth="2" />
        <circle cx="50" cy="42" r="5.5" fill="#6ff0e0" opacity="0.9" />
        <circle cx="70" cy="42" r="5.5" fill="#6ff0e0" opacity="0.9" />
        {/* 手 + 锥形瓶 */}
        <path d="M82 96 l18 6" stroke="#f2d3b3" strokeWidth="7" strokeLinecap="round" />
        <path d="M96 92 h10 v10 l9 20 a5 5 0 0 1 -4 7 h-20 a5 5 0 0 1 -4 -7 l9 -20 z" fill="#7ee0a0" fillOpacity="0.35" stroke="#c2f04a" strokeWidth="2.5" />
        <path d="M101 112 h10 l6 12 h-22 z" fill="#7ee0a0" opacity="0.6" />
      </svg>
    </div>
  );
}
