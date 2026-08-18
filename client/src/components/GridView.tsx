import { useMemo } from "react";
import type { GameStateSnapshot } from "../types";

export function GridView({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);

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
            style={owner ? { background: owner.color, boxShadow: `0 0 0 1px ${owner.color}55 inset` } : undefined}
            title={owner ? `${owner.name}${cell.type === "hq" ? " — HQ" : cell.type === "castle" ? " — Castle" : ""}` : cell.type === "castle" ? "Neutral castle" : "Unclaimed"}
          >
            {cell.type === "hq" && <span className="grid-cell__icon">▲</span>}
            {cell.type === "castle" && <span className="grid-cell__icon">★</span>}
          </div>
        );
      })}
    </div>
  );
}
