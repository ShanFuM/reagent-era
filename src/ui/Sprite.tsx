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

/** 每关一个装饰层：用关卡 id 取模，让同类剪影也能一眼区分 */
function Deco({ variant, color }: { variant: number; color: string }) {
  switch (variant) {
    case 0:
      return (
        <g fill={color} opacity="0.5">
          <rect x="16" y="32" width="11" height="11" rx="2" transform="rotate(20 21 37)" />
          <rect x="132" y="46" width="9" height="9" rx="2" transform="rotate(-18 136 50)" />
          <rect x="120" y="130" width="10" height="10" rx="2" transform="rotate(32 125 135)" />
        </g>
      );
    case 1:
      return (
        <ellipse
          cx="80"
          cy="80"
          rx="74"
          ry="64"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="7 11"
          opacity="0.32"
          className="deco-spin"
        />
      );
    case 2:
      return (
        <g fill={color} opacity="0.45">
          <polygon points="80,2 89,21 71,21" />
          <polygon points="80,158 89,139 71,139" />
          <polygon points="2,80 21,71 21,89" />
          <polygon points="158,80 139,71 139,89" />
        </g>
      );
    case 3:
      return (
        <g fill="none" stroke={color} strokeWidth="3" opacity="0.4" strokeLinecap="round">
          <path d="M20 60 A66 66 0 0 1 60 20" />
          <path d="M100 140 A66 66 0 0 0 140 100" />
        </g>
      );
    default:
      return (
        <g fill={color} opacity="0.45">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            return <circle key={i} cx={80 + Math.cos(a) * 78} cy={80 + Math.sin(a) * 70} r="4" />;
          })}
        </g>
      );
  }
}

/** 手牌上的试剂瓶图标，颜色跟着物质类别走 */
const KIND_COLOR: Record<string, string> = {
  单质: '#cfe0f2',
  氧化物: '#6ba9ff',
  过氧化物: '#ffb648',
  酸: '#ff7a6b',
  碱: '#6ff0a8',
  盐: '#b48cff',
  气体: '#6ff0e0',
  有机物: '#ffd166',
};

export function CardIcon({ kind }: { kind: string }) {
  const c = KIND_COLOR[kind] ?? '#8296aa';
  return (
    <svg className="card-icon" viewBox="0 0 40 48" aria-hidden="true">
      <path
        d="M16 5 h8 v12 l7 18 a6 6 0 0 1 -5 8 H14 a6 6 0 0 1 -5 -8 l7 -18 z"
        fill="rgba(255,255,255,0.04)"
        stroke={c}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M11 33 h18 l3 7 a5 5 0 0 1 -4 6 H12 a5 5 0 0 1 -4 -6 z" fill={c} opacity="0.55" />
      <path d="M14 5 h12" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="18" cy="37" r="2" fill="#fff" opacity="0.65" />
      <circle cx="23" cy="42" r="1.6" fill="#fff" opacity="0.5" />
    </svg>
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
        <Deco variant={level.id % 5} color={p.light} />
      </svg>
    </div>
  );
}

/**
 * 玩家形象：配方师。
 * 原创 SVG：蓬松银发 + 额顶护目镜 + 白大褂 + 蓝色领带 + 苯环徽章。
 */
export function PlayerSprite({ className = '' }: { className?: string }) {
  return (
    <div className={`sprite player-sprite ${className}`} aria-hidden="true">
      <div className="sprite-glow player-glow" />
      <svg viewBox="0 0 120 150" className="sprite-svg">
        <defs>
          <linearGradient id="hero-hair" x1="0.1" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor="#f2f4fc" />
            <stop offset="45%" stopColor="#d3d8ea" />
            <stop offset="100%" stopColor="#9aa3c6" />
          </linearGradient>
          <linearGradient id="hero-coat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#cfd9ec" />
          </linearGradient>
          <linearGradient id="hero-lens" x1="0" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="#f7fbff" />
            <stop offset="100%" stopColor="#bdd0ee" />
          </linearGradient>
        </defs>

        {/* 后发 */}
        <path
          d="M60 14 C38 14 22 32 22 56 C22 78 28 94 40 100 L80 100 C92 94 98 78 98 56 C98 32 82 14 60 14 Z"
          fill="url(#hero-hair)"
          stroke="#2a2f45"
          strokeWidth="3.4"
        />
        <path d="M34 48 C32 70 34 86 40 96" fill="none" stroke="#8b94bb" strokeWidth="2.6" opacity="0.55" strokeLinecap="round" />
        <path d="M86 48 C88 70 86 86 80 96" fill="none" stroke="#8b94bb" strokeWidth="2.6" opacity="0.55" strokeLinecap="round" />

        {/* 白大褂 */}
        <path
          d="M38 150 V104 C38 96 46 92 54 89 L60 98 L66 89 C74 92 82 96 82 104 V150 Z"
          fill="url(#hero-coat)"
          stroke="#2a2f45"
          strokeWidth="3.2"
        />
        <path d="M54 89 L60 100 L66 89 L60 96 Z" fill="#b9c4dc" stroke="#2a2f45" strokeWidth="2.2" />
        <path d="M60 98 l-5 6 l5 18 l5 -18 z" fill="#2b46c8" stroke="#2a2f45" strokeWidth="2.2" />
        <path d="M54 89 L46 150" stroke="#2a2f45" strokeWidth="2.2" fill="none" />
        <path d="M66 89 L74 150" stroke="#2a2f45" strokeWidth="2.2" fill="none" />

        {/* 脸 */}
        <ellipse cx="60" cy="66" rx="22" ry="20" fill="#fbe3d8" stroke="#2a2f45" strokeWidth="3.2" />

        {/* 贴脸的短发 */}
        <path
          d="M40 58 C35 70 35 84 38 96 C43 88 44 70 45 60 Z"
          fill="url(#hero-hair)"
          stroke="#2a2f45"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        <path
          d="M80 58 C85 70 85 84 82 96 C77 88 76 70 75 60 Z"
          fill="url(#hero-hair)"
          stroke="#2a2f45"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />

        {/* 刘海 */}
        <path
          d="M38 54 C38 30 48 21 60 21 C72 21 82 30 82 54 C76 43 68 39 60 41 C52 39 44 43 38 54 Z"
          fill="url(#hero-hair)"
          stroke="#2a2f45"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* 护目镜 */}
        <g transform="rotate(-5 60 22)">
          <rect x="26" y="8" width="68" height="24" rx="12" fill="#e2e9f8" stroke="#2a2f45" strokeWidth="3.2" />
          <rect x="31" y="12" width="26" height="16" rx="8" fill="url(#hero-lens)" stroke="#2a2f45" strokeWidth="2.4" />
          <rect x="63" y="12" width="26" height="16" rx="8" fill="url(#hero-lens)" stroke="#2a2f45" strokeWidth="2.4" />
          <path d="M35 16 l6 -3" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
          <path d="M67 16 l6 -3" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.95" />
        </g>

        {/* 表情 */}
        <path d="M46 67 q6 -7 12 0" fill="none" stroke="#2a2f45" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M62 67 q6 -7 12 0" fill="none" stroke="#2a2f45" strokeWidth="3.6" strokeLinecap="round" />
        <ellipse cx="43" cy="74" rx="5" ry="2.8" fill="#f3a9a0" opacity="0.65" />
        <ellipse cx="77" cy="74" rx="5" ry="2.8" fill="#f3a9a0" opacity="0.65" />
        <path d="M55 76 q5 7 10 0 z" fill="#e5807f" stroke="#2a2f45" strokeWidth="2" strokeLinejoin="round" />

        {/* 苯环徽章 */}
        <path
          d="M45 114 l6.5 -3.8 l6.5 3.8 v7.6 l-6.5 3.8 l-6.5 -3.8 z"
          fill="#c2f04a"
          fillOpacity="0.92"
          stroke="#2a2f45"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}