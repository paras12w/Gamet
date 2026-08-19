import { useMemo, useState } from "react";
import type { GameStateSnapshot } from "../types";
import { BushIcon, CastleIcon, FlagBadge, KnightIcon, NeutralCastleIcon, RockIcon, TreeIcon } from "./icons";

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
  const [selectedKeep, setSelectedKeep] = useState<string | null>(null);

  const battleCells = useMemo(() => {
    const set = new Set<string>();
    for (const b of snapshot.battles) {
      set.add(b.cellA);
      set.add(b.cellB);
    }
    return set;
  }, [snapshot.battles]);

  const selectedCell = selectedKeep ? cellsByKey.get(selectedKeep) : null;
  const selectedOwner = selectedCell?.owner ? guildsById.get(selectedCell.owner) : null;

  return (
    <div className="grid-view-wrap">
      <div
        className="grid-view"
        style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
      >
        {snapshot.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`;
          const owner = cell.owner ? guildsById.get(cell.owner) : null;
          const inBattle = battleCells.has(key);
          const isMine = owner?.id === myGuildId;
          const isPrimaryHq = cell.type === "hq" && !!owner && owner.hq === key;
          const isKeep = cell.type === "castle";

          const roll = hash(cell.x, cell.y);
          const isBare = !!cell.owner || cell.type !== "empty";
          const showTree = !isBare && roll < 12;
          const showRock = !isBare && roll >= 12 && roll < 18;
          const showBush = !isBare && roll >= 18 && roll < 23;

          const roads = owner
            ? DIRS.filter(([, dx, dy]) => cellsByKey.get(`${cell.x + dx},${cell.y + dy}`)?.owner === owner.id)
            : [];

          return (
            <div
              key={key}
              className={[
                "grid-cell",
                isKeep ? "grid-cell--castle" : "",
                cell.type === "hq" ? "grid-cell--hq" : "",
                inBattle ? "grid-cell--battle" : "",
                isMine ? "grid-cell--mine" : "",
                isKeep ? "grid-cell--clickable" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={isKeep ? () => setSelectedKeep(key) : undefined}
              title={
                owner
                  ? `${owner.name}${cell.type === "hq" ? " — Castle" : isKeep ? " — Conquered Keep" : " — Held Ground"}`
                  : isKeep
                    ? "Ancient Keep — click for details"
                    : "Open Field"
              }
            >
              {owner &&
                roads.map(([dir]) => <span key={dir} className={`cell-road cell-road--${dir}`} />)}

              {showTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}
              {showRock && <RockIcon size={12} seed={cell.x * 5 + cell.y * 3} />}
              {showBush && <BushIcon size={11} seed={cell.x * 3 + cell.y * 11} />}

              {isPrimaryHq && (
                <div className="hq-castle-wrap">
                  <CastleIcon color={owner!.color} size="64%" />
                </div>
              )}

              {isKeep && !owner && <NeutralCastleIcon size={18} />}
              {isKeep && owner && <CastleIcon color={owner.color} size={18} />}
              {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={14} />}
            </div>
          );
        })}
      </div>

      {selectedCell && (
        <div className="keep-info">
          <button className="keep-info__close" onClick={() => setSelectedKeep(null)} aria-label="Close">
            ×
          </button>
          <div className="keep-info__badge">
            {selectedOwner ? <FlagBadge color={selectedOwner.color} decal={selectedOwner.flagDecal} size={30} /> : <NeutralCastleIcon size={30} />}
          </div>
          <div>
            <h3>Ancient Keep</h3>
            <p className="keep-info__status">{selectedOwner ? `Held by ${selectedOwner.name}` : "Unclaimed"}</p>
            <p className="keep-info__buff">⚡ Whoever holds this keep gains +1 field automatically every other round — no call required.</p>
          </div>
        </div>
      )}
    </div>
  );
}
