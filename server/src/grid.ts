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

/** Fixed, symmetric spots for neutral castles - independent of grid size scaling. */
export function neutralCastlePositions(): CellKey[] {
  const size = CONFIG.GRID_SIZE;
  const near = Math.round(size * 0.28);
  const far = size - 1 - near;
  return [cellKey(near, near), cellKey(far, near), cellKey(near, far), cellKey(far, far)];
}
