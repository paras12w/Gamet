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

/** Evenly-spaced ring of neutral keep spots, scaled to grid size. */
export function neutralCastlePositions(count: number): CellKey[] {
  const size = CONFIG.GRID_SIZE;
  const center = (size - 1) / 2;
  const radius = center * 0.72;
  const seen = new Set<CellKey>();
  const positions: CellKey[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = Math.min(size - 1, Math.max(0, Math.round(center + radius * Math.cos(angle))));
    const y = Math.min(size - 1, Math.max(0, Math.round(center + radius * Math.sin(angle))));
    const key = cellKey(x, y);
    if (!seen.has(key)) {
      seen.add(key);
      positions.push(key);
    }
  }
  return positions;
}
