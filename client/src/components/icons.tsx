// Small flat-medieval icon set. Kept deliberately simple (basic shapes, no
// heavy paths) so they stay crisp at grid-cell scale and can be recolored
// per guild via a `color` prop.

export function CastleIcon({ color, size = 20 }: { color: string; size?: number }) {
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

export function TreeIcon({ size = 14, seed = 0 }: { size?: number; seed?: number }) {
  const lean = (seed % 5) - 2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
      <rect x="11" y="16" width="2" height="6" fill="#5c4327" />
      <path d="M12 2 L18 12 H6 Z" fill="#3f6b3f" />
      <path d="M12 6 L17.5 15 H6.5 Z" fill="#487a48" />
      <path d="M12 10 L17 18 H7 Z" fill="#3f6b3f" />
    </svg>
  );
}

export function KnightIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21 C7 21 6 17 7 14 L9 14 L9 11 C9 11 8 10 8 8 C8 5.2 9.8 3 12 3 C14.2 3 16 5.2 16 8 C16 10 15 11 15 11 L15 14 L17 14 C18 17 17 21 12 21 Z" fill={color} stroke="#000" strokeOpacity="0.3" strokeWidth="0.4" />
      <rect x="10" y="8" width="4" height="1.6" fill="#1c130a" opacity="0.55" />
      <line x1="12" y1="3" x2="12" y2="0.5" stroke="#5c4a2e" strokeWidth="1" />
      <path d="M12 0.5 L14.5 1.6 L12 2.7 Z" fill="#e8dfc4" />
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
