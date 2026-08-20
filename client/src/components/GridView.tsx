import { useEffect, useMemo, useRef, useState } from "react";
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

// Mirrors server/src/config.ts CONFIG.BRIDGE_TOLL_SILVER - display only,
// same pattern as GuildBar's MAX_PENDING_TILES mirror.
const BRIDGE_TOLL_SILVER = 6;

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
  // Pan/zoom on the board itself, deliberately NOT the page - two-finger
  // pinch, mouse/touch drag, and ctrl/cmd+scroll (trackpad pinch on
  // desktop) all work directly via Pointer Events + a non-passive native
  // wheel listener, with `touch-action: none` on the viewport so the
  // browser never intercepts the gesture for its own page-level zoom
  // (which is also hard-disabled at the viewport-meta level - see
  // index.html - since WebKit can otherwise still zoom the whole page on
  // a pinch regardless of touch-action).
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number; dragged: boolean } | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const lastTap = useRef<{ x: number; y: number; at: number } | null>(null);
  // A pinch or fast wheel-zoom fires many events per second; committing a
  // setState (and the re-render of up to 2500 cell elements that follows)
  // on every single one of them is what made zooming feel choppy. The
  // transform itself is applied straight to the DOM via this ref so the
  // paint keeps up with your fingers immediately - React state (for the %
  // label and the --zoomed class) just follows along, batched to once per
  // animation frame instead of once per event.
  const zoomRafPending = useRef(false);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  function clampZoom(next: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  }

  function applyZoomTransform(z: number) {
    if (gridInnerRef.current) gridInnerRef.current.style.transform = `scale(${z})`;
  }

  function scheduleZoomStateSync() {
    if (zoomRafPending.current) return;
    zoomRafPending.current = true;
    requestAnimationFrame(() => {
      zoomRafPending.current = false;
      setZoom(zoomRef.current);
    });
  }

  /** Zoom to `nextZoom`, keeping whatever's under viewport-relative point
   * (localX, localY) stationary on screen - so a pinch or scroll-zoom
   * anchors to your fingers/cursor instead of always the top-left corner. */
  function zoomAt(nextZoom: number, localX: number, localY: number) {
    const el = viewportRef.current;
    const prevZoom = zoomRef.current;
    const clamped = clampZoom(nextZoom);
    if (el && clamped !== prevZoom) {
      const ratio = clamped / prevZoom;
      el.scrollLeft = (el.scrollLeft + localX) * ratio - localX;
      el.scrollTop = (el.scrollTop + localY) * ratio - localY;
    }
    zoomRef.current = clamped;
    applyZoomTransform(clamped);
    scheduleZoomStateSync();
  }

  function resetZoom() {
    zoomRef.current = 1;
    applyZoomTransform(1);
    setZoom(1);
    const el = viewportRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (!el) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    el.setPointerCapture(e.pointerId);

    if (activePointers.current.size === 2) {
      dragState.current = null;
      const pts = [...activePointers.current.values()];
      pinchDist.current = dist(pts[0], pts[1]);
      return;
    }

    if (activePointers.current.size === 1) {
      // Double-tap/double-click anywhere on the board resets the view -
      // the only "control" left now that zoom is gesture-driven.
      const now = Date.now();
      const last = lastTap.current;
      if (last && now - last.at < 350 && Math.abs(e.clientX - last.x) < 24 && Math.abs(e.clientY - last.y) < 24) {
        resetZoom();
        lastTap.current = null;
        return;
      }
      lastTap.current = { x: e.clientX, y: e.clientY, at: now };

      if (zoomRef.current <= 1 || (e.pointerType === "mouse" && e.button !== 0)) return;
      dragState.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop, dragged: false };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    if (!el || !activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchDist.current) {
      const pts = [...activePointers.current.values()];
      const newDist = dist(pts[0], pts[1]);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const rect = el.getBoundingClientRect();
      zoomAt(zoomRef.current * (newDist / pinchDist.current), mid.x - rect.left, mid.y - rect.top);
      pinchDist.current = newDist;
      return;
    }

    const drag = dragState.current;
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.dragged = true;
    el.scrollLeft = drag.scrollLeft - dx;
    el.scrollTop = drag.scrollTop - dy;
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const el = viewportRef.current;
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchDist.current = null;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    // Swallow the click that follows a real drag so a pan gesture never
    // accidentally places a tile or opens a keep popup.
    if (dragState.current?.dragged) {
      const swallow = (ev: MouseEvent) => ev.stopPropagation();
      el?.addEventListener("click", swallow, { capture: true, once: true });
    }
    dragState.current = null;
  }

  // A native (non-passive) wheel listener - React's synthetic onWheel is
  // passive by default, which silently no-ops preventDefault() and lets
  // the browser's own page-zoom win on a ctrl/cmd+scroll or trackpad
  // pinch. This is what actually keeps that gesture scoped to the board.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return; // plain scroll still just pans/scrolls normally
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.01);
      zoomAt(zoomRef.current * factor, e.clientX - rect.left, e.clientY - rect.top);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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
  const selectedIsRiver = !!selectedCell?.river;
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

  useEffect(() => {
    if (!selectedKeep) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closePopup();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKeep]);

  return (
    <div className="grid-view-wrap" ref={wrapRef}>
      {placementMode && <div className="placement-hint">🎯 Choose an open field next to your territory to place a banked tile.</div>}
      {zoom > 1 && (
        <div className="grid-zoom-hint" aria-hidden="true">
          {Math.round(zoom * 100)}% · double-tap to reset
        </div>
      )}
      <div
        ref={viewportRef}
        className={`grid-zoom-viewport${zoom > 1 ? " grid-zoom-viewport--zoomed" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
      <div
        ref={gridInnerRef}
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
            (!cell.river || cell.riverCrossing) &&
            [
              `${cell.x + 1},${cell.y}`,
              `${cell.x - 1},${cell.y}`,
              `${cell.x},${cell.y + 1}`,
              `${cell.x},${cell.y - 1}`,
            ].some((n) => cellsByKey.get(n)?.owner === myGuildId);

          const clickable = isEligible || isKeep || isHq || !!cell.river;

          function handleClick(e: React.MouseEvent<HTMLDivElement>) {
            if (isEligible) {
              onPlaceTile(cell.x, cell.y);
            } else if (isKeep || isHq || cell.river) {
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
                cell.riverCrossing
                  ? owner
                    ? `Bridge crossing — bridged by ${owner.name}, click for details`
                    : isEligible
                      ? "Bridge crossing — place a banked tile here to pay the toll and settle it"
                      : "Bridge crossing — unclaimed, click for details"
                  : cell.river
                    ? "River — can't be settled, click for details"
                    : isEligible
                      ? "Place your banked tile here"
                      : owner
                        ? `${owner.name}${cell.type === "hq" ? " — Guild HQ, click for details" : isKeep ? ` — Conquered ${RESOURCE_LABEL[kind]}` : " — Held Ground"}`
                        : isKeep
                          ? `${RESOURCE_LABEL[kind]} — click for details`
                          : "Open Field"
              }
            >
              {cell.river && (
                <RiverTile
                  // Seeded off the axis that stays CONSTANT along the flow
                  // (y for a vertical-flowing river, x for a horizontal one)
                  // so consecutive tiles down the same lane share a wave
                  // phase and the texture reads as continuous instead of
                  // jumping to a new unaligned pattern every tile.
                  seed={cell.riverFlowsAlongX ? cell.y : cell.x}
                  vertical={cell.riverFlowsAlongX}
                  crossing={cell.riverCrossing}
                />
              )}
              {owner && cell.type === "empty" && !cell.river && <RoadTile n={roadN} s={roadS} e={roadE} w={roadW} />}

              {showTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}
              {showRock && <RockIcon size={12} seed={cell.x * 5 + cell.y * 3} />}
              {showBush && <BushIcon size={11} seed={cell.x * 3 + cell.y * 11} />}

              {isPrimaryHq && (
                <div className="hq-castle-wrap">
                  <CastleIcon color={owner!.color} size="72%" />
                </div>
              )}

              {isKeep && <ResourceIcon kind={kind} owner={owner ?? null} size={18} />}
              {cell.type === "empty" && owner && <KnightIcon color={owner.color} size={11} />}
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

      {selectedCell && selectedIsRiver && (
        <div className="keep-info keep-info--floating" style={popupStyle}>
          <button className="keep-info__close" onClick={closePopup} aria-label="Close">
            ×
          </button>
          <div className="keep-info__badge">
            {selectedOwner ? (
              <FlagBadge color={selectedOwner.color} decal={selectedOwner.flagDecal} size={56} />
            ) : (
              <span style={{ fontSize: 40 }}>{selectedCell.riverCrossing ? "🌉" : "🌊"}</span>
            )}
          </div>
          <div>
            <h3>{selectedCell.riverCrossing ? "Bridge Crossing" : "River"}</h3>
            <p className="keep-info__status">
              {selectedOwner ? `Bridged by ${selectedOwner.name}` : selectedCell.riverCrossing ? "Unclaimed" : "Impassable"}
            </p>
            <p className="keep-info__desc">
              {selectedCell.riverCrossing
                ? "A shallow ford, worn smooth by old cart tracks - solid enough to build a bridge on."
                : "Deep, fast water. No bridge here - territory can't cross it."}
            </p>
            <p className="keep-info__buff">
              {selectedCell.riverCrossing
                ? selectedOwner
                  ? "⚡ Claimed - this bank's territory now continues across the river here."
                  : `⚡ Place a banked tile here to pay a ${BRIDGE_TOLL_SILVER}-silver toll and claim it, once it borders your territory.`
                : "⚡ The river runs on for a while yet - find a bridge crossing to get your territory across."}
            </p>
          </div>
        </div>
      )}

      {selectedCell && !selectedIsHq && !selectedIsRiver && (
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
