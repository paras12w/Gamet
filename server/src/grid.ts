import { CONFIG } from "./config.js";
import type { CellKey } from "./types.js";

export function cellKey(x: number, y: number): CellKey {
  return `${x},${y}`;
}

export function parseKey(key: CellKey): { x: number; y: number } {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < CONFIG.GRID_SIZE && y < CONFIG.GRID_SIZE;
}

/** Orthogonal (N/S/E/W) neighbor keys within the grid. */
export function neighborsOf(key: CellKey): CellKey[] {
  const { x, y } = parseKey(key);
  const out: CellKey[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny)) out.push(cellKey(nx, ny));
  }
  return out;
}

export function chebyshevDistance(a: CellKey, b: CellKey): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  return Math.max(Math.abs(pa.x - pb.x), Math.abs(pa.y - pb.y));
}

/** The four cell keys of a 2x2 block whose top-left corner is (x, y). */
export function blockCells(x: number, y: number): CellKey[] {
  return [cellKey(x, y), cellKey(x + 1, y), cellKey(x, y + 1), cellKey(x + 1, y + 1)];
}

export function blockInBounds(x: number, y: number): boolean {
  return inBounds(x, y) && inBounds(x + 1, y + 1);
}

/** Chebyshev distance from a cell to the grid's center point. */
function distanceFromCenter(x: number, y: number): number {
  const c = (CONFIG.GRID_SIZE - 1) / 2;
  return Math.max(Math.abs(x - c), Math.abs(y - c));
}

/** Radius (in cells) of the center zone guild HQs are kept out of, so
 * founding a guild doesn't hand you the middle of the map for free -
 * the center stays contested ground full of neutral resource spots. */
export function centerExclusionRadius(): number {
  return (CONFIG.GRID_SIZE - 1) * 0.22;
}

export function isNearCenter(x: number, y: number): boolean {
  return distanceFromCenter(x, y) < centerExclusionRadius();
}

/** Randomly scattered neutral resource spots, spaced apart from each other.
 * Re-rolled every session (called fresh from initGrid), so the map's
 * contested points move around instead of sitting in the same ring.
 * `avoid` cells (e.g. river tiles) are never chosen. */
export function scatterNeutralPositions(count: number, minSpacing: number, avoid: Set<CellKey> = new Set()): CellKey[] {
  const size = CONFIG.GRID_SIZE;
  const positions: CellKey[] = [];
  let attempts = 0;
  while (positions.length < count && attempts < count * 300) {
    attempts++;
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const key = cellKey(x, y);
    if (avoid.has(key)) continue;
    if (positions.some((p) => chebyshevDistance(p, key) < minSpacing)) continue;
    positions.push(key);
  }
  return positions;
}

export interface RiverCell {
  // True if the river's main walk steps along the grid's x index (as
  // opposed to y) - since the client renders x as the vertical screen
  // axis, this cell's water should render with vertical-flowing texture
  // when true, horizontal when false. Purely a rendering hint.
  flowsAlongX: boolean;
  // A buyable bridge point: still open water (unclaimable directly), but
  // a guild can spend a banked tile placement here to pay a toll and
  // claim it, rather than the river just having a random unclaimable gap.
  crossing: boolean;
}

/** Carves `count` winding, fully continuous rivers across the map (roughly
 * edge to edge), each a random walk biased toward one direction with
 * perpendicular jitter. Every consecutive pair of cells in the walk is
 * orthogonally adjacent (shares a full edge, never just a corner) - the
 * same adjacency rule tile placement itself uses - by treating the
 * main-axis advance and the perpendicular jitter as two separate steps
 * instead of combining both coordinate changes into one diagonal jump.
 * About one cell in six along the path is marked as a bridge crossing
 * instead of leaving a plain gap - the river never breaks on its own, but
 * a guild can pay a toll at a crossing to claim it (see BRIDGE_TOLL_SILVER
 * / placeTile). */
export function generateRivers(count: number): Map<CellKey, RiverCell> {
  const size = CONFIG.GRID_SIZE;
  const river = new Map<CellKey, RiverCell>();
  for (let i = 0; i < count; i++) {
    const flowsAlongX = Math.random() < 0.5;
    let x = flowsAlongX ? 0 : Math.floor(Math.random() * size);
    let y = flowsAlongX ? Math.floor(Math.random() * size) : 0;
    const path: CellKey[] = [];
    while (inBounds(x, y)) {
      path.push(cellKey(x, y));
      // Step 1: advance one cell along the primary axis - always orthogonal.
      if (flowsAlongX) x += 1;
      else y += 1;
      if (!inBounds(x, y)) break;
      // Step 2 (kept separate from step 1, never combined): occasionally
      // jitter one cell perpendicular, but push the post-step-1 cell first
      // so the jittered cell stays only one orthogonal hop from its
      // immediate predecessor in `path`.
      if (Math.random() < 0.55) {
        path.push(cellKey(x, y));
        if (flowsAlongX) y += Math.random() < 0.5 ? 1 : -1;
        else x += Math.random() < 0.5 ? 1 : -1;
      }
    }
    // Mark crossings first (every ~6th path cell), then widen: a stretch
    // where the river runs two cells wide on a *fixed* side for a whole
    // contiguous run, rather than an independent per-cell coin flip - which
    // used to leave stray gaps in the "wide" side, since a widened cell
    // wasn't always adjacent to the next one along the run. A widened cell
    // also inherits its parent path cell's crossing status, so a bridge
    // spans the river's full width at that point instead of leaving one of
    // the two lanes uncrossable.
    path.forEach((key, idx) => {
      const crossing = idx % 6 === 5;
      if (!river.has(key) || crossing) river.set(key, { flowsAlongX, crossing });
    });

    let widening = false;
    let widenSide = 1;
    for (const key of path) {
      if (!widening && Math.random() < 0.06) {
        widening = true;
        widenSide = Math.random() < 0.5 ? 1 : -1;
      } else if (widening && Math.random() < 0.2) {
        widening = false;
      }
      if (!widening) continue;
      const { x: px, y: py } = parseKey(key);
      const wx = flowsAlongX ? px : px + widenSide;
      const wy = flowsAlongX ? py + widenSide : py;
      if (!inBounds(wx, wy)) continue;
      const wKey = cellKey(wx, wy);
      if (river.has(wKey)) continue; // never clobber a real path cell
      river.set(wKey, { flowsAlongX, crossing: river.get(key)!.crossing });
    }
  }
  return river;
}
