// Small flat-medieval icon set. Kept deliberately simple (basic shapes, no
// heavy paths) so they stay crisp at grid-cell scale and can be recolored
// per guild via a `color` prop.

const ROAD_COLOR = "#7a6446";

/** A river tile: unclaimable water, rendered as the cell's own background
 * plus a couple of gentle wave strokes for texture. The wave strokes run
 * ALONG the river's actual flow direction (a river running top-to-bottom
 * on screen gets vertical ripples, not horizontal ones crossing it) - the
 * `vertical` flag is a direct passthrough of the cell's own
 * `riverFlowsAlongX`, since the board renders x as the vertical axis. A
 * `crossing` tile is a buyable bridge point, marked with a small plank
 * icon instead of plain open water. */
export function RiverTile({ seed = 0, vertical = false, crossing = false }: { seed?: number; vertical?: boolean; crossing?: boolean }) {
  const offset = seed % 5;
  const amp = 3.2; // curve amplitude - a visibly wavy line, not a near-straight one
  // Each M..Q..T..T path is a full 3-hump sine-like ripple across the tile
  // (the T commands reflect the previous control point automatically), at
  // a fixed perpendicular position that only shifts with `offset` for
  // per-tile variety.
  function hWave(y: number): string {
    return `M0 ${y} Q4 ${y - amp} 8 ${y} T16 ${y} T24 ${y}`;
  }
  function vWave(x: number): string {
    return `M${x} 0 Q${x - amp} 4 ${x} 8 T${x} 16 T${x} 24`;
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: "absolute", inset: "-0.5px" }} aria-hidden="true">
      {/* Rect bleeds 1 unit past every edge of the viewBox (paired with the
          -0.5px inset above) so a hairline of the grass background can never
          show through at the tile boundary if the browser rounds this
          cell's box to a slightly different pixel width than its neighbor's -
          the two river tiles' water then always overlaps by a hair instead
          of leaving a gap. */}
      <rect x="-1" y="-1" width="26" height="26" fill="#2c5270" />
      <rect x="-1" y="-1" width="26" height="26" fill="#1f3f58" opacity="0.35" />
      {vertical ? (
        <>
          <path d={vWave(6 + offset)} fill="none" stroke="#4f80a3" strokeWidth="1.1" opacity="0.65" />
          <path d={vWave(13 - offset * 0.6)} fill="none" stroke="#5f9dc4" strokeWidth="0.8" opacity="0.5" />
          <path d={vWave(19 + offset * 0.4)} fill="none" stroke="#4f80a3" strokeWidth="0.9" opacity="0.45" />
        </>
      ) : (
        <>
          <path d={hWave(6 + offset)} fill="none" stroke="#4f80a3" strokeWidth="1.1" opacity="0.65" />
          <path d={hWave(13 - offset * 0.6)} fill="none" stroke="#5f9dc4" strokeWidth="0.8" opacity="0.5" />
          <path d={hWave(19 + offset * 0.4)} fill="none" stroke="#4f80a3" strokeWidth="0.9" opacity="0.45" />
        </>
      )}
      {crossing && (
        <g>
          {vertical ? (
            <>
              <rect x="2" y="9" width="20" height="6" rx="1" fill="#7a6446" stroke="#3a2814" strokeWidth="0.5" />
              <line x1="2" y1="11" x2="22" y2="11" stroke="#5c4a2e" strokeWidth="0.6" />
              <line x1="2" y1="13" x2="22" y2="13" stroke="#5c4a2e" strokeWidth="0.6" />
            </>
          ) : (
            <>
              <rect x="9" y="2" width="6" height="20" rx="1" fill="#7a6446" stroke="#3a2814" strokeWidth="0.5" />
              <line x1="11" y1="2" x2="11" y2="22" stroke="#5c4a2e" strokeWidth="0.6" />
              <line x1="13" y1="2" x2="13" y2="22" stroke="#5c4a2e" strokeWidth="0.6" />
            </>
          )}
        </g>
      )}
    </svg>
  );
}

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

/** Tech sector structure: a forge with a glowing gear, doubles the Tech
 * tile bonus while held. */
export function FoundryIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="4" y="13" width="16" height="7" fill="#5c584c" stroke="#2e2c24" strokeWidth="0.5" />
      <path d="M6 13 L6 7 L9 10 L12 6 L15 10 L18 7 L18 13 Z" fill="#3a3830" stroke="#2e2c24" strokeWidth="0.5" />
      <circle cx="12" cy="15.5" r="3" fill="#a4302a" opacity="0.9" />
      <circle cx="12" cy="15.5" r="1.6" fill="#e8b04a" />
      <path
        d="M12 12.2 L12.6 13.3 L13.8 13.1 L13.3 14.2 L14.2 15 L13 15.3 L13 16.5 L12 15.8 L11 16.5 L11 15.3 L9.8 15 L10.7 14.2 L10.2 13.1 L11.4 13.3 Z"
        fill="#d4a843"
        opacity="0.85"
      />
    </svg>
  );
}

/** Finance sector structure: a strongbox, grants passive silver interest
 * while held. */
export function VaultIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="4" y="9" width="16" height="11" rx="1.5" fill="#3a3428" stroke="#1f1c15" strokeWidth="0.6" />
      <rect x="6" y="11" width="12" height="7" fill="#5c5340" stroke="#2e2c24" strokeWidth="0.4" />
      <circle cx="12" cy="14.5" r="2.4" fill="#d4a843" stroke="#4a3616" strokeWidth="0.5" />
      <circle cx="12" cy="14.5" r="0.8" fill="#2e2c24" />
      <rect x="5" y="7.5" width="14" height="2" fill="#7d7666" stroke="#2e2c24" strokeWidth="0.4" />
    </svg>
  );
}

/** Energy sector structure: a drum + pipe rig, doubles the Energy silver
 * bonus while held. */
export function RefineryIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="5" y="10" width="5" height="10" rx="1" fill="#3d5a52" stroke="#1f1c15" strokeWidth="0.5" />
      <rect x="13" y="6" width="6" height="14" rx="1" fill="#4c7a44" stroke="#1f1c15" strokeWidth="0.5" />
      <rect x="6" y="12" width="3" height="1.4" fill="#2e2c24" />
      <rect x="14" y="9" width="4" height="1.4" fill="#2e2c24" />
      <rect x="14" y="13" width="4" height="1.4" fill="#2e2c24" />
      <path d="M10 15 H13" stroke="#7d7666" strokeWidth="1.4" />
      <circle cx="16" cy="4.5" r="1.8" fill="#a4302a" opacity="0.85" />
    </svg>
  );
}

/** Hostile neutral spot: raids the nearest guild's silver until captured. */
export function BanditCampIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="9" ry="1.4" fill="#000" opacity="0.2" />
      <path d="M4 20 L12 8 L20 20 Z" fill="#3a2e22" stroke="#1f1710" strokeWidth="0.6" />
      <path d="M12 8 L12 20" stroke="#1f1710" strokeWidth="0.5" opacity="0.4" />
      <circle cx="12" cy="14.5" r="3.4" fill="#e8dfc4" stroke="#2e2c24" strokeWidth="0.5" />
      <circle cx="10.6" cy="13.8" r="0.8" fill="#1f1c15" />
      <circle cx="13.4" cy="13.8" r="0.8" fill="#1f1c15" />
      <path d="M10.4 16 Q12 17 13.6 16" fill="none" stroke="#1f1c15" strokeWidth="0.6" />
    </svg>
  );
}

/** One-time neutral spot: pays a lump silver sum on capture, then reverts
 * to plain empty land. */
export function RuinsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="20.5" rx="9" ry="1.4" fill="#000" opacity="0.18" />
      <rect x="4" y="10" width="2.6" height="10" fill="#8a8577" stroke="#5c584c" strokeWidth="0.4" />
      <rect x="10.7" y="7" width="2.6" height="13" fill="#96917f" stroke="#5c584c" strokeWidth="0.4" />
      <rect x="17.4" y="12" width="2.6" height="8" fill="#8a8577" stroke="#5c584c" strokeWidth="0.4" />
      <path d="M4 10 L6.6 10 L9 8 L4 8 Z" fill="#7d7666" opacity="0.8" />
      <circle cx="12" cy="4.5" r="1.6" fill="#d4a843" opacity="0.85" />
    </svg>
  );
}

/** Neutral spot: free automatic scouting of any rival guild you're
 * currently bordering. */
export function WatchtowerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21" rx="7" ry="1.3" fill="#000" opacity="0.18" />
      <path d="M8 20 L9.5 6 H14.5 L16 20 Z" fill="#7d7666" stroke="#4a453a" strokeWidth="0.5" />
      <rect x="8.5" y="15" width="7" height="2" fill="#5c584c" />
      <rect x="9" y="3" width="6" height="3.5" fill="#5c584c" stroke="#2e2c24" strokeWidth="0.4" />
      <circle cx="12" cy="4.7" r="1.3" fill="#e8b04a">
        <animate attributeName="opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
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
  // Rounded/deciduous variant: a single wobbly canopy silhouette (not
  // overlapping circles) with a lighter facet patch for depth.
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
      <rect x="11.2" y="15" width="1.6" height="7" fill="#5c4327" />
      <path
        d="M5 11 Q4 6.5 9 6 Q10 2.5 15 3.5 Q20 3 20.5 8 Q22 11.5 18 14 Q17.5 17.5 11.5 16.5 Q5.5 17.5 4 13 Q3 11.5 5 11 Z"
        fill="#3f6b3f"
        stroke="#2e4726"
        strokeWidth="0.4"
      />
      <path
        d="M8 10 Q8 6 12 6.5 Q15 5 17.5 7.5 Q19 9.5 17 12 Q17 14.5 13 14 Q8.5 15 7 12 Q6.5 10.5 8 10 Z"
        fill="#487a48"
        opacity="0.85"
      />
    </svg>
  );
}

export function RockIcon({ size = 12, seed = 0 }: { size?: number; seed?: number }) {
  const rot = (seed % 7) - 3;
  const s = size + (seed % 5) - 2;
  if (seed % 2 === 0) {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
        <ellipse cx="12" cy="18.5" rx="9" ry="1.5" fill="#000" opacity="0.17" />
        <path d="M3 18 L5 12 L9 9 L9 13 L13 8 L18 10 L20 15 L19 18 Z" fill="#8a8577" stroke="#5c584c" strokeWidth="0.6" />
        <path d="M9 9 L13 8 L14 11 L10 13 Z" fill="#a19c8c" />
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
  // A single scalloped foliage blob (not stacked circles) with a lighter
  // facet patch offset inside it for a bit of leafy depth.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `translateX(${lean}%)` }}>
      <ellipse cx="12" cy="20" rx="7" ry="1.3" fill="#000" opacity="0.15" />
      <path
        d="M4 16 Q3 10.5 8 10 Q9 6 14 6.5 Q19 5.5 20 10.5 Q22 14 18.5 17 Q17.5 20.5 11.5 19.5 Q5.5 20.5 4 16 Z"
        fill="#3f6b3f"
        stroke="#2e4726"
        strokeWidth="0.4"
      />
      <path
        d="M7 14 Q7 10.5 11 10.5 Q13 8.5 16 10 Q18.5 10.5 18 14 Q19 16.5 15.5 17 Q11 18 8 16 Q6 15.5 7 14 Z"
        fill="#487a48"
        opacity="0.85"
      />
    </svg>
  );
}

/** A wandering villager: no weapon or armor, just a hood and tunic colored
 * per guild - flavor for a settled field, not a soldier standing watch. Legs
 * spread in a walking stride; the actual "walking" motion is a CSS animation
 * applied to the wrapping element (see .villager-wrap), not this SVG. */
export function VillagerIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="21.5" rx="5" ry="1" fill="#000" opacity="0.18" />
      <path d="M9 17.5 L7.5 22" stroke="#5c4a2e" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 17.5 L16 21.5" stroke="#5c4a2e" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 9.5 H15 L14.2 18 C14.1 18.8 13.2 19.3 12 19.3 C10.8 19.3 9.9 18.8 9.8 18 Z" fill={color} stroke="#000" strokeOpacity="0.3" strokeWidth="0.4" />
      <path d="M8.6 10.5 L6.8 14.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.4 10.5 L17 13.8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="6.6" r="2.7" fill="#e0b28a" />
      <path d="M8.9 6.8 A3.1 3.1 0 0 1 15.1 6.8 L14.6 5.4 C14.2 4.2 13.2 3.6 12 3.6 C10.8 3.6 9.8 4.2 9.4 5.4 Z" fill="#6b4a2a" opacity="0.85" />
    </svg>
  );
}

export function FlagBadge({ color, decal, size = 22 }: { color: string; decal: string; size?: number }) {
  const width = size * 1.15;
  const height = size * 0.8;
  const flagLeft = size * 0.1;
  const coin = size * 0.6;
  // Center the coin on the flag's solid rectangular body, left of the
  // pointed notch cut into its right edge.
  const coinLeft = flagLeft + width * 0.42 - coin / 2;
  const coinTop = height / 2 - coin / 2;
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
      <svg width={width} height={height} style={{ position: "absolute", left: flagLeft, top: 0 }} viewBox="0 0 46 32">
        <path d="M0 0 H46 L40 8 L46 16 L46 24 L0 32 Z" fill={color} stroke="#000" strokeOpacity="0.3" strokeWidth="0.6" />
      </svg>
      {/* A small parchment coin behind the emblem so it stays legible against
          any guild color, including dark ones. */}
      <span className="flag-badge__coin" style={{ left: coinLeft, top: coinTop, width: coin, height: coin }}>
        <span className="flag-badge__decal" style={{ fontSize: size * 0.42 }}>
          {decal}
        </span>
      </span>
    </span>
  );
}

/** Settled ground: a uniform, always-centered dirt texture for any owned
 * open field. Earlier versions tried to auto-tile a directional ribbon
 * toward each same-owner neighbor (a la road auto-tiling), but that made
 * any tile with only one or two connections render as an asymmetric,
 * off-center blotch instead of a clean tile, and a cluster of those next
 * to each other read as a disconnected patchwork rather than one
 * settlement. A single full-tile fill has no directional logic to get
 * wrong - it's the same shape on every tile regardless of its neighbors,
 * so it's always centered and adjacent tiles always read as one
 * contiguous area. The fill bleeds 1 unit past the viewBox, paired with a
 * -0.5px CSS inset on the SVG itself, so two adjacent tiles' fills always
 * overlap by a hair instead of a subpixel grid-track rounding difference
 * leaving a hairline of grass showing through. */
export function RoadTile({ seed = 0 }: { seed?: number }) {
  const jitter = seed % 5;
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: "absolute", inset: "-0.5px" }} aria-hidden="true">
      <rect x="-1" y="-1" width="26" height="26" fill={ROAD_COLOR} />
      <rect x="3" y="3" width="18" height="18" fill="#8a7050" opacity="0.25" />
      <rect x="0" y="0" width="24" height="24" fill="none" stroke="#4a3a24" strokeWidth="1" opacity="0.25" />
      <circle cx={7 + jitter * 0.6} cy={16 - jitter * 0.5} r="0.8" fill="#4a3a24" opacity="0.5" />
      <circle cx={17 - jitter * 0.5} cy={8 + jitter * 0.5} r="0.7" fill="#4a3a24" opacity="0.4" />
      <circle cx={12 + jitter * 0.4} cy={12 - jitter * 0.4} r="0.6" fill="#4a3a24" opacity="0.4" />
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
