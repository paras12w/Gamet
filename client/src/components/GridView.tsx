import { useMemo, useState } from "react";
import type { GameStateSnapshot, ResourceKind } from "../types";
import { BushIcon, CastleIcon, FlagBadge, KnightIcon, LumberCampIcon, MineIcon, NeutralCastleIcon, RoadTile, RockIcon, TreeIcon } from "./icons";

function hash(x: number, y: number): number {
  const h = (x * 374761393 + y * 668265263) ^ (x << 13);
  return Math.abs((h * 2654435761) % 100);
}

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  keep: "Ancient Keep",
  lumber: "Lumber Camp",
  mine: "Ore Mine",
};

const RESOURCE_DESCRIPTION: Record<ResourceKind, string> = {
  keep: "A crumbling watchtower from a realm long forgotten. Its walls still hold.",
  lumber: "Stacked timber and a woodsman's axe, left for whoever's strong enough to hold the clearing.",
  mine: "A shaft driven into the hillside, ore glinting in the dark. Worth fighting over.",
};

const RESOURCE_BUFF: Record<ResourceKind, string> = {
  keep: "Whoever holds this keep gains +1 field automatically every other round — no call required.",
  lumber: "This camp's timber reinforces its holder's borders: +1 field automatically every other round.",
  mine: "This mine's ore funds expansion for its holder: +1 field automatically every other round.",
};

function ResourceIcon({ kind, owner, size }: { kind: ResourceKind; owner: { color: string } | null; size: number }) {
  if (owner) return <CastleIcon color={owner.color} size={size} />;
  if (kind === "lumber") return <LumberCampIcon size={size} />;
  if (kind === "mine") return <MineIcon size={size} />;
  return <NeutralCastleIcon size={size} />;
}

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
  const selectedKind: ResourceKind = selectedCell?.resourceKind ?? "keep";

  return (
    <div className="grid-view-wrap">
      <div
        className={`grid-view${snapshot.marketOpen ? "" : " grid-view--night"}`}
        style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
      >
        {snapshot.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`;
          const owner = cell.owner ? guildsById.get(cell.owner) : null;
          const inBattle = battleCells.has(key);
          const isMine = owner?.id === myGuildId;
          const isPrimaryHq = cell.type === "hq" && !!owner && owner.hq === key;
          const isKeep = cell.type === "castle";
          const kind: ResourceKind = cell.resourceKind ?? "keep";

          const roll = hash(cell.x, cell.y);
          const isBare = !!cell.owner || cell.type !== "empty";
          const showTree = !isBare && roll < 12;
          const showRock = !isBare && roll >= 12 && roll < 18;
          const showBush = !isBare && roll >= 18 && roll < 23;

          const roadN = owner ? cellsByKey.get(`${cell.x},${cell.y - 1}`)?.owner === owner.id : false;
          const roadS = owner ? cellsByKey.get(`${cell.x},${cell.y + 1}`)?.owner === owner.id : false;
          const roadE = owner ? cellsByKey.get(`${cell.x + 1},${cell.y}`)?.owner === owner.id : false;
          const roadW = owner ? cellsByKey.get(`${cell.x - 1},${cell.y}`)?.owner === owner.id : false;

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
                  ? `${owner.name}${cell.type === "hq" ? " — Castle" : isKeep ? ` — Conquered ${RESOURCE_LABEL[kind]}` : " — Held Ground"}`
                  : isKeep
                    ? `${RESOURCE_LABEL[kind]} — click for details`
                    : "Open Field"
              }
            >
              {owner && cell.type === "empty" && <RoadTile n={roadN} s={roadS} e={roadE} w={roadW} />}

              {showTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}
              {showRock && <RockIcon size={12} seed={cell.x * 5 + cell.y * 3} />}
              {showBush && <BushIcon size={11} seed={cell.x * 3 + cell.y * 11} />}

              {isPrimaryHq && (
                <div className="hq-castle-wrap">
                  <CastleIcon color={owner!.color} size="64%" />
                </div>
              )}

              {isKeep && <ResourceIcon kind={kind} owner={owner ?? null} size={18} />}
              {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={17} />}
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
            {selectedOwner ? (
              <FlagBadge color={selectedOwner.color} decal={selectedOwner.flagDecal} size={30} />
            ) : (
              <ResourceIcon kind={selectedKind} owner={null} size={30} />
            )}
          </div>
          <div>
            <h3>{RESOURCE_LABEL[selectedKind]}</h3>
            <p className="keep-info__status">{selectedOwner ? `Held by ${selectedOwner.name}` : "Unclaimed"}</p>
            <p className="keep-info__desc">{RESOURCE_DESCRIPTION[selectedKind]}</p>
            <p className="keep-info__buff">⚡ {RESOURCE_BUFF[selectedKind]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
