import { useMemo, useState } from "react";
import type { GameStateSnapshot, ResourceKind } from "../types";
import { BushIcon, CastleIcon, ExchangeIcon, FlagBadge, KnightIcon, LumberCampIcon, MineIcon, NeutralCastleIcon, RoadTile, RockIcon, TreeIcon } from "./icons";
import { formatCoins } from "../lib/coins";

function hash(x: number, y: number): number {
  const h = (x * 374761393 + y * 668265263) ^ (x << 13);
  return Math.abs((h * 2654435761) % 100);
}

const RESOURCE_LABEL: Record<ResourceKind, string> = {
  keep: "Ancient Keep",
  lumber: "Lumber Camp",
  mine: "Ore Mine",
  exchange: "Market Exchange",
};

const RESOURCE_DESCRIPTION: Record<ResourceKind, string> = {
  keep: "A crumbling watchtower from a realm long forgotten. Its walls still hold.",
  lumber: "Stacked timber and a woodsman's axe, left for whoever's strong enough to hold the clearing.",
  mine: "A shaft driven into the hillside, ore glinting in the dark. Worth fighting over.",
  exchange: "A trading post where coin changes hands faster than anywhere else in the realm.",
};

const RESOURCE_BUFF: Record<ResourceKind, string> = {
  keep: "Whoever holds this keep gains +1 field automatically every other round — no call required.",
  lumber: "This camp's timber reinforces its holder's borders: +1 field automatically every other round.",
  mine: "This mine's ore funds expansion for its holder: +1 field automatically every other round.",
  exchange: "This exchange pays its holder silver directly every other round, instead of expanding your borders.",
};

function ResourceIcon({ kind, owner, size }: { kind: ResourceKind; owner: { color: string } | null; size: number }) {
  if (owner) return <CastleIcon color={owner.color} size={size} />;
  if (kind === "lumber") return <LumberCampIcon size={size} />;
  if (kind === "mine") return <MineIcon size={size} />;
  if (kind === "exchange") return <ExchangeIcon size={size} />;
  return <NeutralCastleIcon size={size} />;
}

export function GridView({
  snapshot,
  myGuildId,
  placementMode,
  onPlaceTile,
}: {
  snapshot: GameStateSnapshot;
  myGuildId: string | null;
  placementMode: boolean;
  onPlaceTile: (x: number, y: number) => void;
}) {
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);
  const cellsByKey = useMemo(() => new Map(snapshot.cells.map((c) => [`${c.x},${c.y}`, c])), [snapshot.cells]);
  const rankedGuilds = useMemo(() => [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount), [snapshot.guilds]);
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
  const selectedIsHq = selectedCell?.type === "hq";
  const selectedRank = selectedOwner ? rankedGuilds.findIndex((g) => g.id === selectedOwner.id) + 1 : 0;

  let popupStyle: React.CSSProperties | undefined;
  if (selectedCell) {
    const gridSize = snapshot.gridSize;
    // Board is laid out row=x, col=y (server fills the grid x-outer/y-inner,
    // which CSS grid auto-placement fills row-major) - so x drives the
    // vertical position on screen and y drives the horizontal.
    const topPct = Math.min(88, Math.max(12, ((selectedCell.x + 0.5) / gridSize) * 100));
    const cellLeftPct = (selectedCell.y / gridSize) * 100;
    const cellRightPct = ((selectedCell.y + 1) / gridSize) * 100;
    const placeOnRight = cellLeftPct < 50;
    popupStyle = placeOnRight
      ? { left: `calc(${cellRightPct}% + 10px)`, top: `${topPct}%` }
      : { right: `calc(${100 - cellLeftPct}% + 10px)`, top: `${topPct}%` };
  }

  return (
    <div className="grid-view-wrap">
      {placementMode && <div className="placement-hint">🎯 Choose an open field next to your territory to place a banked tile.</div>}
      <div
        className={`grid-view${snapshot.marketOpen ? "" : " grid-view--night"}${placementMode ? " grid-view--placing" : ""}`}
        style={{ gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`, gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)` }}
      >
        {snapshot.cells.map((cell) => {
          const key = `${cell.x},${cell.y}`;
          const owner = cell.owner ? guildsById.get(cell.owner) : null;
          const inBattle = battleCells.has(key);
          const isMine = owner?.id === myGuildId;
          const isPrimaryHq = cell.type === "hq" && !!owner && owner.hq === key;
          const isHq = cell.type === "hq" && !!owner;
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

          const isEligible =
            placementMode &&
            !!myGuildId &&
            cell.owner === null &&
            [
              `${cell.x + 1},${cell.y}`,
              `${cell.x - 1},${cell.y}`,
              `${cell.x},${cell.y + 1}`,
              `${cell.x},${cell.y - 1}`,
            ].some((n) => cellsByKey.get(n)?.owner === myGuildId);

          const clickable = isEligible || isKeep || isHq;

          function handleClick() {
            if (isEligible) onPlaceTile(cell.x, cell.y);
            else if (isKeep || isHq) setSelectedKeep(key);
          }

          return (
            <div
              key={key}
              className={[
                "grid-cell",
                isKeep ? "grid-cell--castle" : "",
                cell.type === "hq" ? "grid-cell--hq" : "",
                inBattle ? "grid-cell--battle" : "",
                isMine ? "grid-cell--mine" : "",
                clickable ? "grid-cell--clickable" : "",
                isEligible ? "grid-cell--eligible" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={clickable ? handleClick : undefined}
              title={
                isEligible
                  ? "Place your banked tile here"
                  : owner
                    ? `${owner.name}${cell.type === "hq" ? " — Guild HQ, click for details" : isKeep ? ` — Conquered ${RESOURCE_LABEL[kind]}` : " — Held Ground"}`
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
                  <span className="hq-flag-overlay">
                    <FlagBadge color={owner!.color} decal={owner!.flagDecal} size={22} />
                  </span>
                </div>
              )}

              {isKeep && <ResourceIcon kind={kind} owner={owner ?? null} size={18} />}
              {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={17} />}
              {isEligible && <span className="grid-cell__place-marker">+</span>}
            </div>
          );
        })}
      </div>

      {selectedCell && selectedIsHq && selectedOwner && (
        <div className="keep-info keep-info--floating" style={popupStyle}>
          <button className="keep-info__close" onClick={() => setSelectedKeep(null)} aria-label="Close">
            ×
          </button>
          <div className="keep-info__badge">
            <FlagBadge color={selectedOwner.color} decal={selectedOwner.flagDecal} size={56} />
          </div>
          <div>
            <h3>{selectedOwner.name}</h3>
            <p className="keep-info__status">Guild Headquarters</p>
            <p className="keep-info__desc">
              Led by {selectedOwner.leaderUsername} &middot; {selectedOwner.members.length} member{selectedOwner.members.length === 1 ? "" : "s"}
            </p>
            <p className="keep-info__buff">
              #{selectedRank} &middot; {selectedOwner.squareCount} fields &middot; {formatCoins(selectedOwner.tokens)}
              {selectedOwner.sessionsWon > 0 ? ` · 🏆×${selectedOwner.sessionsWon}` : ""}
              {selectedOwner.takeovers > 0 ? ` · 👑×${selectedOwner.takeovers}` : ""}
            </p>
          </div>
        </div>
      )}

      {selectedCell && !selectedIsHq && (
        <div className="keep-info keep-info--floating" style={popupStyle}>
          <button className="keep-info__close" onClick={() => setSelectedKeep(null)} aria-label="Close">
            ×
          </button>
          <div className="keep-info__badge">
            {selectedOwner ? (
              <FlagBadge color={selectedOwner.color} decal={selectedOwner.flagDecal} size={56} />
            ) : (
              <ResourceIcon kind={selectedKind} owner={null} size={56} />
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
