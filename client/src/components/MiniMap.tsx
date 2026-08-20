import { useMemo, useState } from "react";
import type { GameStateSnapshot } from "../types";

export function MiniMap({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);
  const [mode, setMode] = useState<"territory" | "heat">("territory");

  const heatIndex = useMemo(() => {
    const map = new Map<string, number>();
    snapshot.recentBattleCells.forEach((key, i) => map.set(key, (i + 1) / snapshot.recentBattleCells.length));
    return map;
  }, [snapshot.recentBattleCells]);

  return (
    <div className="panel minimap-panel">
      <div className="panel__header">
        <h2>Territory</h2>
        <button type="button" className="minimap__mode-btn" onClick={() => setMode(mode === "territory" ? "heat" : "territory")}>
          {mode === "territory" ? "🔥 Heat" : "🗺️ Territory"}
        </button>
      </div>
      <div
        className="minimap"
        style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
      >
        {snapshot.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`;
          let background: string;
          let isMine = false;
          if (mode === "heat") {
            const intensity = heatIndex.get(key) ?? 0;
            background = intensity > 0 ? `rgba(232, 90, 42, ${0.25 + intensity * 0.65})` : cell.river ? "#2c5270" : "var(--grass-dark)";
          } else {
            const owner = cell.owner ? guildsById.get(cell.owner) : null;
            isMine = owner?.id === myGuildId;
            if (owner) background = owner.color;
            else if (cell.river) background = "#2c5270";
            else if (cell.type === "castle") background = "var(--gold)";
            else background = "var(--grass-dark)";
          }
          return <div key={key} className={isMine ? "minimap__cell minimap__cell--mine" : "minimap__cell"} style={{ background }} />;
        })}
      </div>
    </div>
  );
}
