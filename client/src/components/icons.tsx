// Small flat-medieval icon set. Kept deliberately simple (basic shapes, no
// heavy paths) so they stay crisp at grid-cell scale and can be recolored
// per guild via a `color` prop.

const ROAD_COLOR = "#7a6446";

export function CastleIcon({ color, size = 20 }: { color: string; size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" fill={color} stroke="#000" strokeOpacity="0.25" strokeWidth="0.5" />
      <rect x="4" y="7" width="3" height="4" fill={color} />
      <rect x="10.5" y="7" width="3" height="4" fill={color} />
      <rect x="17" y="7" width="3" height="4" fill={color} />
      <rect x="10" y="15" width="4" height="6" fill="#1c130a" opacity="0.55" />
      <line x1="12" y1="7" x2="12" y2="2" stroke="#5c4a2e" strokeWidth="1" />
      <path d="M12 2 L17 4.2 L12 6.4 Z" fill="#a4302a" />
    </svg>
  );
}

export function NeutralCastleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="11" width="18" height="10" fill="#7d7666" stroke="#4a453a" strokeWidth="0.5" />
      <rect x="3" y="7" width="3.2" height="4" fill="#7d7666" />
      <rect x="10.4" y="7" width="3.2" height="4" fill="#7d7666" />
      <rect x="17.8" y="7" width="3.2" height="4" fill="#7d7666" />
      <rect x="9.5" y="15" width="5" height="6" fill="#2a251b" opacity="0.6" />
      <circle cx="12" cy="9" r="1.4" fill="#d4a843" stroke="#4a453a" strokeWidth="0.4" />
    </svg>
  );
}

export function LumberCampIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="20.5" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="4" y="14" width="16" height="3" rx="1.4" fill="#6b4a2a" stroke="#3a2814" strokeWidth="0.4" />
      <circle cx="4.6" cy="15.5" r="1.6" fill="#8a6238" stroke="#3a2814" strokeWidth="0.4" />
      <circle cx="19.4" cy="15.5" r="1.6" fill="#8a6238" stroke="#3a2814" strokeWidth="0.4" />
      <rect x="5" y="10.6" width="14" height="3" rx="1.4" fill="#7a5530" stroke="#3a2814" strokeWidth="0.4" />
      <circle cx="5.6" cy="12" r="1.5" fill="#96703f" stroke="#3a2814" strokeWidth="0.4" />
      <circle cx="18.4" cy="12" r="1.5" fill="#96703f" stroke="#3a2814" strokeWidth="0.4" />
      <rect x="10.4" y="3.5" width="1.4" height="8" fill="#4a3018" />
      <path d="M9.8 3.5 L14 3.5 L13 6.8 L10.8 6.8 Z" fill="#a8a8a0" stroke="#4a453a" strokeWidth="0.4" />
    </svg>
  );
}

export function MineIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <path d="M4 20 L4 12 Q12 4.5 20 12 L20 20 Z" fill="#6b6252" stroke="#3a3428" strokeWidth="0.6" />
      <path d="M6.5 20 L6.5 13 Q12 7.5 17.5 13 L17.5 20 Z" fill="#161311" />
      <rect x="5.3" y="9.6" width="2" height="10.4" fill="#5c4327" />
      <rect x="16.7" y="9.6" width="2" height="10.4" fill="#5c4327" />
      <rect x="4.8" y="8.8" width="14.4" height="2" fill="#6b4a2a" />
      <circle cx="9" cy="17" r="0.9" fill="#d4a843" />
      <circle cx="14" cy="15.2" r="0.7" fill="#d4a843" />
      <circle cx="11.5" cy="18.2" r="0.6" fill="#d4a843" />
    </svg>
  );
}

export function ExchangeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="4" y="12" width="16" height="8" fill="#7a5530" stroke="#3a2814" strokeWidth="0.5" />
      <path d="M3 12 L12 6 L21 12 Z" fill="#a4302a" stroke="#3a2814" strokeWidth="0.5" />
      <path d="M3 12 L7.5 12 L12 8.6 L16.5 12 L21 12" fill="none" stroke="#e8dfc4" strokeWidth="0.5" opacity="0.7" />
      <rect x="10" y="15" width="4" height="5" fill="#1c130a" opacity="0.5" />
      <circle cx="6.5" cy="16.5" r="1.5" fill="#d4a843" stroke="#4a3616" strokeWidth="0.4" />
      <circle cx="17.5" cy="16.5" r="1.5" fill="#d4a843" stroke="#4a3616" strokeWidth="0.4" />
      <text x="6.5" y="17.3" fontSize="1.8" textAnchor="middle" fill="#4a3616" fontFamily="serif">
        $
      </text>
      <text x="17.5" y="17.3" fontSize="1.8" textAnchor="middle" fill="#4a3616" fontFamily="serif">
        $
      </text>
    </svg>
  );
}

export function TreeIcon({ size = 14, seed = 0 }: { size?: number; seed?: number }) {
  const lean = (seed % 5) - 2;
  const s = size + (seed % 4) - 1;
  if (seed % 2 === 0) {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
        <rect x="11" y="16" width="2" height="6" fill="#5c4327" />
        <path d="M12 2 L18 12 H6 Z" fill="#3f6b3f" />
        <path d="M12 6 L17.5 15 H6.5 Z" fill="#487a48" />
        <path d="M12 10 L17 18 H7 Z" fill="#3f6b3f" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
      <rect x="11.2" y="15" width="1.6" height="7" fill="#5c4327" />
      <circle cx="9" cy="10" r="5" fill="#4c7a44" />
      <circle cx="15" cy="9" r="5.5" fill="#3f6b3f" />
      <circle cx="12" cy="13" r="5" fill="#487a48" />
    </svg>
  );
}

export function RockIcon({ size = 12, seed = 0 }: { size?: number; seed?: number }) {
  const rot = (seed % 7) - 3;
  const s = size + (seed % 5) - 2;
  if (seed % 3 === 0) {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
        <ellipse cx="12" cy="19.5" rx="8" ry="1.4" fill="#000" opacity="0.16" />
        <circle cx="8" cy="15" r="4.5" fill="#8a8577" stroke="#5c584c" strokeWidth="0.5" />
        <circle cx="14.5" cy="14" r="5.5" fill="#96917f" stroke="#5c584c" strokeWidth="0.5" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <ellipse cx="12" cy="19" rx="9" ry="1.6" fill="#000" opacity="0.18" />
      <path d="M4 17 L6 10 L11 6 L17 8 L20 14 L18 18 L6 18 Z" fill="#8a8577" stroke="#5c584c" strokeWidth="0.6" />
      <path d="M6 10 L11 6 L13 9 L9 13 Z" fill="#a19c8c" />
    </svg>
  );
}

export function BushIcon({ size = 11, seed = 0 }: { size?: number; seed?: number }) {
  const lean = (seed % 5) - 2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
      <ellipse cx="12" cy="20" rx="7" ry="1.3" fill="#000" opacity="0.15" />
      <circle cx="8" cy="15" r="5.5" fill="#3f6b3f" />
      <circle cx="15" cy="14" r="6" fill="#487a48" />
      <circle cx="12" cy="17" r="5" fill="#4c7a44" />
    </svg>
  );
}

/** A standing soldier: spear + shield, tunic colored per guild. */
export function KnightIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="22" rx="6" ry="1.2" fill="#000" opacity="0.2" />
      <line x1="18.5" y1="2" x2="18.5" y2="19" stroke="#6b5537" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M18.5 1 L20.5 4.5 L16.5 4.5 Z" fill="#a8a8a0" stroke="#4a453a" strokeWidth="0.4" />
      <rect x="9.5" y="17" width="2" height="5" fill="#3a2e1a" />
      <rect x="12.5" y="17" width="2" height="5" fill="#3a2e1a" />
      <path d="M8.5 10 H15.5 V17.5 C15.5 18.5 14.5 19 12 19 C9.5 19 8.5 18.5 8.5 17.5 Z" fill={color} stroke="#000" strokeOpacity="0.3" strokeWidth="0.4" />
      <rect x="9" y="14.5" width="6" height="1.4" fill="#00000022" />
      <circle cx="12" cy="6.5" r="3" fill="#e0b28a" />
      <path d="M8.7 6.2 A3.3 3.3 0 0 1 15.3 6.2 L15.3 5 C15.3 3.6 13.8 2.6 12 2.6 C10.2 2.6 8.7 3.6 8.7 5 Z" fill="#8a8577" stroke="#4a453a" strokeWidth="0.4" />
      <ellipse cx="5.8" cy="12.5" rx="2.3" ry="3.1" fill={color} stroke="#1c130a" strokeOpacity="0.4" strokeWidth="0.5" />
      <line x1="5.8" y1="10" x2="5.8" y2="15" stroke="#e8dfc4" strokeOpacity="0.6" strokeWidth="0.5" />
    </svg>
  );
}

export function FlagBadge({ color, decal, size = 22 }: { color: string; decal: string; size?: number }) {
  const width = size * 1.15;
  const height = size * 0.8;
  return (
    <span
      className="flag-badge"
      style={{ width, height: size * 1.25, minWidth: width }}
      role="img"
      aria-label="guild flag"
    >
      <svg width={size * 0.12} height={size * 1.25} style={{ position: "absolute", left: 0 }}>
        <rect width="100%" height="100%" fill="#5c4a2e" />
      </svg>
      <svg width={width} height={height} style={{ position: "absolute", left: size * 0.1, top: 0 }} viewBox="0 0 46 32">
        <path d="M0 0 H46 L40 8 L46 16 L46 24 L0 32 Z" fill={color} stroke="#000" strokeOpacity="0.25" strokeWidth="0.6" />
      </svg>
      <span className="flag-badge__decal" style={{ left: size * 0.1, width, height, fontSize: size * 0.44 }}>
        {decal}
      </span>
    </span>
  );
}

const ROAD_EDGE = {
  N: { x: 12, y: 0 },
  S: { x: 12, y: 24 },
  E: { x: 24, y: 12 },
  W: { x: 0, y: 12 },
} as const;

const ROAD_OPPOSITE: Record<string, string> = { N: "S", S: "N", E: "W", W: "E" };

/** Auto-connecting dirt path: straight segments, a smooth curve on a turn,
 * a hub blob on junctions, and a small dot for an isolated field. */
export function RoadTile({ n, s, e, w }: { n: boolean; s: boolean; e: boolean; w: boolean }) {
  const active = (["N", "S", "E", "W"] as const).filter((d) => ({ N: n, S: s, E: e, W: w })[d]);

  if (active.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx="12" cy="12" r="3" fill={ROAD_COLOR} opacity="0.85" />
      </svg>
    );
  }

  let d: string;
  if (active.length === 2 && ROAD_OPPOSITE[active[0]] !== active[1]) {
    const [a, b] = active;
    d = `M ${ROAD_EDGE[a].x} ${ROAD_EDGE[a].y} Q 12 12 ${ROAD_EDGE[b].x} ${ROAD_EDGE[b].y}`;
  } else {
    d = active.map((dir) => `M 12 12 L ${ROAD_EDGE[dir].x} ${ROAD_EDGE[dir].y}`).join(" ");
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <path d={d} stroke="#000" strokeOpacity="0.25" strokeWidth="8.5" strokeLinecap="round" fill="none" />
      <path d={d} stroke={ROAD_COLOR} strokeWidth="7" strokeLinecap="round" fill="none" />
      {active.length >= 3 && <circle cx="12" cy="12" r="4" fill={ROAD_COLOR} />}
    </svg>
  );
}

export function Hourglass({ fraction, size = 40 }: { fraction: number; size?: number }) {
  const f = Math.max(0, Math.min(1, fraction));
  // f = fraction of time REMAINING. Top bulb drains as f shrinks.
  const topSandHeight = 9 * f;
  const bottomSandHeight = 9 * (1 - f);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="2" width="16" height="2" rx="0.6" fill="#c9a227" />
      <rect x="4" y="20" width="16" height="2" rx="0.6" fill="#c9a227" />
      <path d="M6 4 H18 L13 12 L18 20 H6 L11 12 Z" fill="none" stroke="#c9a227" strokeWidth="1.2" strokeLinejoin="round" />
      <clipPath id="topBulb">
        <path d="M6.8 4.6 H17.2 L12.3 12 Z" />
      </clipPath>
      <clipPath id="bottomBulb">
        <path d="M6.8 19.4 H17.2 L12 12 Z" />
      </clipPath>
      <rect x="6" y={11 - topSandHeight} width="12" height={topSandHeight} fill="#e8dfc4" clipPath="url(#topBulb)" />
      <rect x="6" y={20 - bottomSandHeight - 1} width="12" height={bottomSandHeight} fill="#e8dfc4" clipPath="url(#bottomBulb)" />
      {f > 0.02 && <rect x="11.4" y="11.6" width="1.2" height="0.8" fill="#e8dfc4" opacity="0.9" />}
    </svg>
  );
}
