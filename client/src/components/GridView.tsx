import { useMemo, useRef, useState } from "react";
import type { GameStateSnapshot, ResourceKind } from "../types";
import {
  BanditCampIcon,
  BushIcon,
  CastleIcon,
  ExchangeIcon,
  FlagBadge,
  FoundryIcon,
  KnightIcon,
  LumberCampIcon,
  MineIcon,
  NeutralCastleIcon,
  RefineryIcon,
  RiverTile,
  RoadTile,
  RockIcon,
  RuinsIcon,
  TreeIcon,
  VaultIcon,
  WatchtowerIcon,
} from "./icons";
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
  foundry: "Tech Foundry",
  vault: "Finance Vault",
  refinery: "Energy Refinery",
  bandit_camp: "Bandit Camp",
  ruins: "Ancient Ruins",
  watchtower: "Watchtower",
};

const RESOURCE_DESCRIPTION: Record<ResourceKind, string> = {
  keep: "A crumbling watchtower from a realm long forgotten. Its walls still hold.",
  lumber: "Stacked timber and a woodsman's axe, left for whoever's strong enough to hold the clearing.",
  mine: "A shaft driven into the hillside, ore glinting in the dark. Worth fighting over.",
  exchange: "A trading post where coin changes hands faster than anywhere else in the realm.",
  foundry: "Forge-fires and gearwork, humming with Tech-kingdom energy.",
  vault: "A fortified strongbox, said to make silver breed silver for whoever holds the key.",
  refinery: "Pipes and drums venting steam - the Energy kingdom's beating heart.",
  bandit_camp: "A bandit warband camps here, raiding whoever's closest until someone runs them off.",
  ruins: "Half-buried ruins - a single grab for lost treasure, then just quiet dirt.",
  watchtower: "A tall lookout with a lit beacon, watching every border it touches.",
};

const RESOURCE_BUFF: Record<ResourceKind, string> = {
  keep: "Whoever holds this keep gains +1 field automatically every other round — no call required.",
  lumber: "This camp's timber reinforces its holder's borders: +1 field automatically every other round.",
  mine: "This mine's ore funds expansion for its holder: +1 field automatically every other round.",
  exchange: "This exchange pays its holder silver directly every other round, instead of expanding your borders.",
  foundry: "Doubles your Tech-sector tile bonus on a winning Tech call, for as long as you hold it.",
  vault: "Pays its holder silver interest every other round, scaled to how much silver you're already holding.",
  refinery: "Doubles your Energy-sector silver bonus on a winning Energy call, for as long as you hold it.",
  bandit_camp: "Raids silver from the nearest guild every other round until someone captures it.",
  ruins: "Pays a one-time lump of silver to whoever claims it, then reverts to plain empty land.",
  watchtower: "Reveals the locked-in call of any rival guild you're currently bordering — free, no scouting cost.",
};

function ResourceIcon({ kind, owner, size }: { kind: ResourceKind; owner: { color: string } | null; size: number }) {
  if (owner) return <CastleIcon color={owner.color} size={size} />;
  if (kind === "lumber") return <LumberCampIcon size={size} />;
  if (kind === "mine") return <MineIcon size={size} />;
  if (kind === "exchange") return <ExchangeIcon size={size} />;
  if (kind === "foundry") return <FoundryIcon size={size} />;
  if (kind === "vault") return <VaultIcon size={size} />;
  if (kind === "refinery") return <RefineryIcon size={size} />;
  if (kind === "bandit_camp") return <BanditCampIcon size={size} />;
  if (kind === "ruins") return <RuinsIcon size={size} />;
  if (kind === "watchtower") return <WatchtowerIcon size={size} />;
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
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number; dragged: boolean } | null>(null);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;
  const ZOOM_STEP = 0.5;

  function clampZoom(next: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  }

  function zoomBy(delta: number) {
    setZoom((z) => clampZoom(Math.round((z + delta) * 100) / 100));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1 || e.button !== 0) return;
    const el = viewportRef.current;
    if (!el) return;
    dragState.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, dragged: false };
    el.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragState.current;
    const el = viewportRef.current;
    if (!drag || !el) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.dragged = true;
    el.scrollLeft = drag.scrollLeft - dx;
    el.scrollTop = drag.scrollTop - dy;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    // Swallow the click that follows a real drag so a pan gesture never
    // accidentally places a tile or opens a keep popup.
    if (dragState.current?.dragged) {
      const swallow = (ev: MouseEvent) => ev.stopPropagation();
      el?.addEventListener("click", swallow, { capture: true, once: true });
    }
    dragState.current = null;
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return; // trackpad pinch / ctrl+wheel only - plain scroll still pans
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
  }

  const wrapRef = useRef<HTMLDivElement>(null);
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);
  const cellsByKey = useMemo(() => new Map(snapshot.cells.map((c) => [`${c.x},${c.y}`, c])), [snapshot.cells]);
  const rankedGuilds = useMemo(() => [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount), [snapshot.guilds]);
  const [selectedKeep, setSelectedKeep] = useState<string | null>(null);
  // The clicked cell's own on-screen box (relative to grid-view-wrap), captured
  // at click time - needed because a percentage-of-grid calc breaks once the
  // board can be zoomed/panned to an arbitrary scroll offset.
  const [anchorRect, setAnchorRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

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
  if (selectedCell && anchorRect) {
    const wrapWidth = wrapRef.current?.clientWidth ?? anchorRect.left * 2;
    const wrapHeight = wrapRef.current?.clientHeight ?? anchorRect.top * 2;
    const placeOnRight = anchorRect.left < wrapWidth / 2;
    const top = Math.min(wrapHeight - 20, Math.max(20, anchorRect.top + anchorRect.height / 2));
    popupStyle = placeOnRight
      ? { left: `${anchorRect.left + anchorRect.width + 10}px`, top: `${top}px` }
      : { right: `${wrapWidth - anchorRect.left + 10}px`, top: `${top}px` };
  }

  function closePopup() {
    setSelectedKeep(null);
    setAnchorRect(null);
  }

  return (
    <div className="grid-view-wrap" ref={wrapRef}>
      {placementMode && <div className="placement-hint">🎯 Choose an open field next to your territory to place a banked tile.</div>}
      <div className="grid-zoom-controls">
        <button type="button" onClick={() => zoomBy(-ZOOM_STEP)} disabled={zoom <= ZOOM_MIN} aria-label="Zoom out">
          −
        </button>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= ZOOM_MAX} aria-label="Zoom in">
          +
        </button>
      </div>
      <div
        ref={viewportRef}
        className={`grid-zoom-viewport${zoom > 1 ? " grid-zoom-viewport--zoomed" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
      <div
        className={`grid-view${snapshot.marketOpen ? "" : " grid-view--night"}${placementMode ? " grid-view--placing" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${snapshot.gridSize}, 1fr)`,
          gridTemplateRows: `repeat(${snapshot.gridSize}, 1fr)`,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
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
          const isBare = !!cell.owner || cell.type !== "empty" || !!cell.river;
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
            !cell.river &&
            [
              `${cell.x + 1},${cell.y}`,
              `${cell.x - 1},${cell.y}`,
              `${cell.x},${cell.y + 1}`,
              `${cell.x},${cell.y - 1}`,
            ].some((n) => cellsByKey.get(n)?.owner === myGuildId);

          const clickable = isEligible || isKeep || isHq;

          function handleClick(e: React.MouseEvent<HTMLDivElement>) {
            if (isEligible) {
              onPlaceTile(cell.x, cell.y);
            } else if (isKeep || isHq) {
              const wrapRect = wrapRef.current?.getBoundingClientRect();
              const cellRect = e.currentTarget.getBoundingClientRect();
              if (wrapRect) {
                setAnchorRect({
                  left: cellRect.left - wrapRect.left,
                  top: cellRect.top - wrapRect.top,
                  width: cellRect.width,
                  height: cellRect.height,
                });
              }
              setSelectedKeep(key);
            }
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
                cell.river ? "grid-cell--river" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={clickable ? handleClick : undefined}
              title={
                cell.river
                  ? "River — can't be settled"
                  : isEligible
                    ? "Place your banked tile here"
                    : owner
                      ? `${owner.name}${cell.type === "hq" ? " — Guild HQ, click for details" : isKeep ? ` — Conquered ${RESOURCE_LABEL[kind]}` : " — Held Ground"}`
                      : isKeep
                        ? `${RESOURCE_LABEL[kind]} — click for details`
                        : "Open Field"
              }
            >
              {cell.river && <RiverTile seed={cell.x * 7 + cell.y} />}
              {owner && cell.type === "empty" && <RoadTile n={roadN} s={roadS} e={roadE} w={roadW} />}

              {showTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}
              {showRock && <RockIcon size={12} seed={cell.x * 5 + cell.y * 3} />}
              {showBush && <BushIcon size={11} seed={cell.x * 3 + cell.y * 11} />}

              {isPrimaryHq && (
                <div className="hq-castle-wrap">
                  <span className="hq-flag-slot">
                    <FlagBadge color={owner!.color} decal={owner!.flagDecal} size={26} />
                  </span>
                  <CastleIcon color={owner!.color} size="52%" />
                </div>
              )}

              {isKeep && <ResourceIcon kind={kind} owner={owner ?? null} size={18} />}
              {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={17} />}
              {isEligible && (
                <svg className="grid-cell__place-marker" width="42%" height="42%" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="10" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
                  <rect x="3" y="10" width="18" height="4" rx="1.5" fill="currentColor" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
      </div>

      {selectedCell && selectedIsHq && selectedOwner && (
        <div className="keep-info keep-info--floating" style={popupStyle}>
          <button className="keep-info__close" onClick={closePopup} aria-label="Close">
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
          <button className="keep-info__close" onClick={closePopup} aria-label="Close">
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
