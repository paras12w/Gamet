import { useMemo } from "react";
import type { GameStateSnapshot } from "../types";
import { CastleIcon, KnightIcon, NeutralCastleIcon, TreeIcon } from "./icons";

function hash(x: number, y: number): number {
  const h = (x * 374761393 + y * 668265263) ^ (x << 13);
  return Math.abs((h * 2654435761) % 100);
}

const DIRS: Array<[string, number, number]> = [
  ["N", 0, -1],
  ["S", 0, 1],
  ["E", 1, 0],
  ["W", -1, 0],
];

export function GridView({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);
  const cellsByKey = useMemo(() => new Map(snapshot.cells.map((c) => [`${c.x},${c.y}`, c])), [snapshot.cells]);

  const battleCells = useMemo(() => {
    const set = new Set<string>();
    for (const b of snapshot.battles) {
      set.add(b.cellA);
      set.add(b.cellB);
    }
    return set;
  }, [snapshot.battles]);

  return (
    <div
      className="grid-view"
      style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
    >
      {snapshot.cells.map((cell) => {
        const key = `${cell.x},${cell.y}`;
        const owner = cell.owner ? guildsById.get(cell.owner) : null;
        const inBattle = battleCells.has(key);
        const isMine = owner?.id === myGuildId;
        const hasTree = !cell.owner && cell.type === "empty" && hash(cell.x, cell.y) < 16;

        const roads = owner
          ? DIRS.filter(([, dx, dy]) => cellsByKey.get(`${cell.x + dx},${cell.y + dy}`)?.owner === owner.id)
          : [];

        return (
          <div
            key={key}
            className={[
              "grid-cell",
              cell.type === "castle" ? "grid-cell--castle" : "",
              cell.type === "hq" ? "grid-cell--hq" : "",
              inBattle ? "grid-cell--battle" : "",
              isMine ? "grid-cell--mine" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={
              owner
                ? `${owner.name}${cell.type === "hq" ? " — Castle" : cell.type === "castle" ? " — Conquered Keep" : " — Held Ground"}`
                : cell.type === "castle"
                  ? "Unclaimed Keep"
                  : "Open Field"
            }
          >
            {owner &&
              roads.map(([dir]) => <span key={dir} className={`cell-road cell-road--${dir}`} style={{ background: "#7a6446" }} />)}

            {hasTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}

            {(cell.type === "hq" || (cell.type === "castle" && owner)) && <CastleIcon color={owner!.color} size={cell.type === "hq" ? 19 : 17} />}
            {cell.type === "castle" && !owner && <NeutralCastleIcon size={17} />}
            {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={14} />}
          </div>
        );
      })}
    </div>
  );
}
