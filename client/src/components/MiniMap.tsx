import { useMemo } from "react";
import type { GameStateSnapshot } from "../types";

export function MiniMap({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);

  return (
    <div className="panel minimap-panel">
      <div className="panel__header">
        <h2>Territory</h2>
      </div>
      <div
        className="minimap"
        style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
      >
        {snapshot.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`;
          const owner = cell.owner ? guildsById.get(cell.owner) : null;
          const isMine = owner?.id === myGuildId;
          let background = "var(--grass-dark)";
          if (owner) background = owner.color;
          else if (cell.type === "castle") background = "var(--gold)";
          return <div key={key} className={isMine ? "minimap__cell minimap__cell--mine" : "minimap__cell"} style={{ background }} />;
        })}
      </div>
    </div>
  );
}
