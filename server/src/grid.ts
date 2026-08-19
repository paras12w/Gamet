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
 * contested points move around instead of sitting in the same ring. */
export function scatterNeutralPositions(count: number, minSpacing: number): CellKey[] {
  const size = CONFIG.GRID_SIZE;
  const positions: CellKey[] = [];
  let attempts = 0;
  while (positions.length < count && attempts < count * 300) {
    attempts++;
    const x = Math.floor(Math.random() * size);
    const y = Math.floor(Math.random() * size);
    const key = cellKey(x, y);
    if (positions.some((p) => chebyshevDistance(p, key) < minSpacing)) continue;
    positions.push(key);
  }
  return positions;
}
