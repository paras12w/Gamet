import { useEffect, useMemo, useRef, useState } from "react";
import type { GameStateSnapshot, ResourceKind } from "../types";
import {
  BanditCampIcon,
  BushIcon,
  CastleIcon,
  ExchangeIcon,
  FlagBadge,
  FoundryIcon,
  LumberCampIcon,
  MineIcon,
  NeutralCastleIcon,
  RefineryIcon,
  RiverTile,
  RoadTile,
  RockIcon,
  RuinsIcon,
  SuperCastleIcon,
  TreeIcon,
  VaultIcon,
  WatchtowerIcon,
} from "./icons";
import { formatCoins } from "../lib/coins";

// Mirrors server/src/config.ts CONFIG.BRIDGE_TILE_COST - display only, same
// pattern as GuildBar's MAX_PENDING_TILES mirror.
const BRIDGE_TILE_COST = 5;

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
  super_castle: "The Sovereign's Seat",
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
  super_castle: "A grand fortress at the very heart of the realm, said to double the fortunes of whoever holds it.",
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
  super_castle: "Doubles every other keep, mine, vault, foundry, refinery, and exchange bonus you hold, for as long as you hold it.",
};

function ResourceIcon({ kind, owner, size }: { kind: ResourceKind; owner: { color: string } | null; size: number | string }) {
  if (kind === "super_castle") return <SuperCastleIcon color={owner?.color} size={size} />;
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
  onBuyBridge,
}: {
  snapshot: GameStateSnapshot;
  myGuildId: string | null;
  placementMode: boolean;
  onPlaceTile: (x: number, y: number) => void;
  onBuyBridge: (x: number, y: number) => void;
}) {
  // Pan/zoom on the board itself, deliberately NOT the page - two-finger
  // pinch, mouse/touch drag, and ctrl/cmd+scroll (trackpad pinch on
  // desktop) all work directly via Pointer Events + a non-passive native
  // wheel listener, with `touch-action: none` on the viewport so the
  // browser never intercepts the gesture for its own page-level zoom
  // (which is also hard-disabled at the viewport-meta level - see
  // index.html - since WebKit can otherwise still zoom the whole page on
  // a pinch regardless of touch-action).
  //
  // Pan is tracked as an explicit translate offset (panRef), NOT via the
  // viewport's native scrollLeft/scrollTop. Panning via scroll relies on
  // the browser correctly recomputing "scrollable overflow" for a CHILD
  // that's grown past its own layout box purely via `transform: scale()` -
  // Chromium/Firefox get this right, but mobile WebKit has historically
  // been inconsistent about it, which is what made pinch-zoom feel
  // glitchy/rubber-bandy specifically on phones even after desktop was
  // smooth. Combining pan + zoom into one `translate() scale()` transform
  // sidesteps the browser's scroll/overflow model entirely - it's just
  // arithmetic we own, so it behaves identically on every platform.
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const gridInnerRef = useRef<HTMLDivElement>(null);
  const gridOverlayRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; panX: number; panY: number; dragged: boolean } | null>(null);
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
  // Reading layout geometry (getBoundingClientRect/clientWidth/clientHeight)
  // forces the browser to synchronously flush any pending style changes and
  // recompute layout for the whole page before it can answer - fine once,
  // but doing it on EVERY pointermove during an active pinch/drag (which
  // can fire 60-120 times/sec on a touchscreen) repeatedly blocks the main
  // thread and is what made zooming lag the whole device, not just the
  // board. Cache the viewport's rect here instead, refreshed only when it
  // can actually change (mount, resize, and at the start of each gesture),
  // and read every event.
  const viewportRectRef = useRef<DOMRect | null>(null);

  function measureViewportRect() {
    if (viewportRef.current) viewportRectRef.current = viewportRef.current.getBoundingClientRect();
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    measureViewportRect();
    const ro = new ResizeObserver(measureViewportRect);
    ro.observe(el);
    window.addEventListener("resize", measureViewportRect);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureViewportRect);
    };
  }, []);

  const ZOOM_MIN = 1;
  const ZOOM_MAX = 4;

  function clampZoom(next: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  }

  /** Keeps the pan offset from ever revealing empty space beyond the
   * content's edge - the content (unscaled size = the viewport's own
   * width/height, since .grid-view fills the viewport at zoom 1) can only
   * be dragged until its far edge reaches the viewport's near edge, in
   * either direction. Takes the cached rect rather than measuring live -
   * see viewportRectRef above. */
  function clampPan(pan: { x: number; y: number }, z: number): { x: number; y: number } {
    const w = viewportRectRef.current?.width ?? 0;
    const h = viewportRectRef.current?.height ?? 0;
    const minX = w * (1 - z);
    const minY = h * (1 - z);
    return { x: Math.min(0, Math.max(minX, pan.x)), y: Math.min(0, Math.max(minY, pan.y)) };
  }

  // Level-of-detail threshold for decorations (tree/rock/bush secondary
  // facet paths - see .grid-view--far in styles.css) - toggled the same
  // imperative way as the transform itself, not via React state, so
  // crossing it mid-zoom never touches the ~2500-cell render tree. Zoomed
  // out past 1x is exactly when there are the most decorated tiles visible
  // on screen at once and the least benefit to their extra detail, so it's
  // also where trimming pays off most.
  const LOD_ZOOM_THRESHOLD = 1;
  function applyTransform() {
    const transform = `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoomRef.current})`;
    if (gridInnerRef.current) {
      gridInnerRef.current.style.transform = transform;
      gridInnerRef.current.classList.toggle("grid-view--far", zoomRef.current <= LOD_ZOOM_THRESHOLD);
    }
    // The eligible-tile overlay (grid-view-overlay) is a separate element
    // from .grid-view on purpose (see its own comment below), but that means
    // it needs this same live transform applied to it explicitly - it isn't
    // a descendant of gridInnerRef, so it never inherits this write. Missing
    // this is exactly what let it drift out of sync with the real board
    // during a drag/pinch: the overlay only picked up a fresh transform on
    // whatever React re-render happened to fire next (a zoom-state sync,
    // a new snapshot), not on every pan frame, so it would visually freeze
    // in place while the board moved underneath it - eligible tiles then
    // read as being "in the wrong spot" relative to your own territory
    // after any pan.
    if (gridOverlayRef.current) {
      gridOverlayRef.current.style.transform = transform;
    }
  }

  // Toggled directly on the DOM (not React state) so it costs nothing extra
  // per gesture event - see .grid-view--gesturing in styles.css, which
  // pauses the villager/eligible/battle CSS animations for as long as this
  // class is present.
  const gestureEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function markGesturing() {
    gridInnerRef.current?.classList.add("grid-view--gesturing");
    if (gestureEndTimer.current) clearTimeout(gestureEndTimer.current);
    gestureEndTimer.current = setTimeout(() => {
      gridInnerRef.current?.classList.remove("grid-view--gesturing");
    }, 200);
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
    const prevZoom = zoomRef.current;
    const clamped = clampZoom(nextZoom);
    if (clamped !== prevZoom) {
      const ratio = clamped / prevZoom;
      panRef.current = {
        x: panRef.current.x * ratio + localX * (1 - ratio),
        y: panRef.current.y * ratio + localY * (1 - ratio),
      };
    }
    zoomRef.current = clamped;
    panRef.current = clampPan(panRef.current, clamped);
    applyTransform();
    scheduleZoomStateSync();
  }

  function resetZoom() {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    applyTransform();
    setZoom(1);
  }

  /** Pans (and zooms in at least a little, if not already) so cell (cx, cy)
   * lands dead center in the viewport - used to jump straight to the
   * eligible-tile cluster the moment placement mode opens, so "where can I
   * place" never depends on the player having already scrolled/zoomed to
   * the right spot on a huge board (see the placementMode effect below). */
  function centerOnCell(cx: number, cy: number) {
    const rect = viewportRectRef.current;
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const z = clampZoom(Math.max(zoomRef.current, 2));
    const cellCenterX = ((cx + 0.5) / snapshot.gridSize) * rect.width;
    const cellCenterY = ((cy + 0.5) / snapshot.gridSize) * rect.height;
    zoomRef.current = z;
    panRef.current = clampPan({ x: rect.width / 2 - cellCenterX * z, y: rect.height / 2 - cellCenterY * z }, z);
    applyTransform();
    setZoom(z);
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
      measureViewportRect();
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
      measureViewportRect();
      dragState.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y, dragged: false };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchDist.current) {
      const rect = viewportRectRef.current;
      if (!rect) return;
      markGesturing();
      const pts = [...activePointers.current.values()];
      const newDist = dist(pts[0], pts[1]);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      zoomAt(zoomRef.current * (newDist / pinchDist.current), mid.x - rect.left, mid.y - rect.top);
      pinchDist.current = newDist;
      return;
    }

    const drag = dragState.current;
    if (!drag) return;
    markGesturing();
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.dragged = true;
    panRef.current = clampPan({ x: drag.panX + dx, y: drag.panY + dy }, zoomRef.current);
    applyTransform();
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
      if (!viewportRectRef.current) measureViewportRect();
      const rect = viewportRectRef.current;
      if (!rect) return;
      markGesturing();
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

  // Memoized on everything the per-cell render actually depends on -
  // deliberately NOT on `zoom`. A pinch or wheel gesture re-syncs `zoom`
  // state once per animation frame (see scheduleZoomStateSync), which
  // re-renders this component; without this memo, every one of those
  // frames would re-run this ~2500-cell map (hash calcs, several Map
  // lookups per cell for road/eligibility) even though none of that data
  // changed - pure wasted work fighting the gesture for the same main
  // thread. Memoizing means a zoom-only re-render reuses the exact same
  // array of already-built elements, so React can bail out of touching
  // this whole subtree instead of re-evaluating it every frame.
  const cellElements = useMemo(() => {
    return snapshot.cells.map((cell) => {
      const key = `${cell.x},${cell.y}`;
      const owner = cell.owner ? guildsById.get(cell.owner) : null;
      const inBattle = battleCells.has(key);
      const isMine = owner?.id === myGuildId;
      const isPrimaryHq = cell.type === "hq" && !!owner && owner.hq === key;
      const isHq = cell.type === "hq" && !!owner;
      const isKeep = cell.type === "castle";
      const kind: ResourceKind = cell.resourceKind ?? "keep";
      // A grown 2x2 keep-flavored castle or the 3x3 super castle shares one
      // structureAnchor key across every cell in its block - only the anchor
      // cell renders the (bigger) icon and mine/rival border, spanning the
      // whole footprint, the same trick .hq-castle-wrap already uses for a
      // guild's own 2x2 HQ. An ordinary 1x1 castle has no structureAnchor at
      // all, so it's unaffected by any of this.
      const isStructureMember = !!cell.structureAnchor;
      const isStructureAnchor = isStructureMember && cell.structureAnchor === key;

      const roll = hash(cell.x, cell.y);
      const isBare = !!cell.owner || cell.type !== "empty" || !!cell.river;
      const showTree = !isBare && roll < 12;
      const showRock = !isBare && roll >= 12 && roll < 18;
      const showBush = !isBare && roll >= 18 && roll < 23;

      const neighborKeys = [
        `${cell.x + 1},${cell.y}`,
        `${cell.x - 1},${cell.y}`,
        `${cell.x},${cell.y + 1}`,
        `${cell.x},${cell.y - 1}`,
      ];

      const isBridgeBuyable =
        !!myGuildId && !!cell.river && cell.owner === null && neighborKeys.some((n) => cellsByKey.get(n)?.owner === myGuildId);

      const hasRoadOrRiver = !!cell.river || (!!owner && cell.type === "empty");

      const clickable = isKeep || isHq || !!cell.river;

      function handleClick(e: React.MouseEvent<HTMLDivElement>) {
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

      return (
        <div
          key={key}
          className={[
            "grid-cell",
            isKeep ? "grid-cell--castle" : "",
            cell.type === "hq" ? "grid-cell--hq" : "",
            inBattle ? "grid-cell--battle" : "",
            // Ownership border is a castle-only signal (HQ via .hq-castle-wrap,
            // conquered keeps via this box-shadow) - plain claimed fields
            // (roads) intentionally carry none of it. Every claimed road tile
            // used to get this same border since `isMine`/`owner` are true for
            // ANY owned cell regardless of type, not just castles - across a
            // mature territory that's a LOT of white/black-bordered squares,
            // which is what read as "the roads have borders now" once zoomed
            // in enough to actually see them.
            isKeep && isMine && !isStructureMember ? "grid-cell--mine" : "",
            isKeep && owner && !isMine && !isStructureMember ? "grid-cell--rival" : "",
            clickable ? "grid-cell--clickable" : "",
            isBridgeBuyable ? "grid-cell--eligible" : "",
            cell.river ? "grid-cell--river" : "",
            hasRoadOrRiver ? "grid-cell--no-seam" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={clickable ? handleClick : undefined}
          title={
            cell.river
              ? owner
                ? `Bridge — built by ${owner.name}, click for details`
                : isBridgeBuyable
                  ? `River — click to build a bridge here for ${BRIDGE_TILE_COST} silver`
                  : "River — impassable, click for details"
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
              crossing={!!cell.owner}
            />
          )}
          {owner && cell.type === "empty" && !cell.river && <RoadTile seed={cell.x * 7 + cell.y * 3} />}

          {showTree && <TreeIcon size={13} seed={cell.x * 7 + cell.y} />}
          {showRock && <RockIcon size={12} seed={cell.x * 5 + cell.y * 3} />}
          {showBush && <BushIcon size={11} seed={cell.x * 3 + cell.y * 11} />}

          {isPrimaryHq && (
            <div className={`hq-castle-wrap ${isMine ? "hq-castle-wrap--mine" : "hq-castle-wrap--rival"}`}>
              <CastleIcon color={owner!.color} size="72%" />
            </div>
          )}

          {isStructureAnchor && (
            <div
              className={`structure-wrap ${owner ? (isMine ? "structure-wrap--mine" : "structure-wrap--rival") : ""}`}
              style={{ width: `${(cell.structureSize ?? 2) * 100}%`, height: `${(cell.structureSize ?? 2) * 100}%` }}
            >
              <ResourceIcon kind={kind} owner={owner ?? null} size="60%" />
            </div>
          )}

          {isKeep && !isStructureMember && <ResourceIcon kind={kind} owner={owner ?? null} size={18} />}
        </div>
      );
    });
    // Deliberately NOT dependent on `placementMode`/`onPlaceTile` - which
    // cells are eligible to place a tile on is computed separately below
    // (eligibleCells) from just the guild's own territory, not by scanning
    // every cell on the board. Toggling placement mode used to force this
    // entire ~2500-cell map to re-run (hash calcs, neighbor lookups, road
    // seeding, for cells that never change) just to add a highlight to a
    // few dozen of them - which is what made opening the placement UI feel
    // slow. See the `.grid-cell--place-overlay` cells rendered as siblings
    // of this array for how eligibility is now shown instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.cells, guildsById, cellsByKey, battleCells, myGuildId]);

  // Cheap, placementMode-scoped alternative to scanning the whole board:
  // only the guild's own (typically small) territory needs to be walked to
  // find its unclaimed, non-river neighbors. Returns nothing at all when
  // not in placement mode, so toggling it off is instant too.
  const eligibleCells = useMemo(() => {
    if (!placementMode || !myGuildId) return [];
    const myGuild = guildsById.get(myGuildId);
    if (!myGuild) return [];
    const seen = new Set<string>();
    const result: { x: number; y: number; key: string }[] = [];
    for (const ownedKey of myGuild.squares) {
      const [xs, ys] = ownedKey.split(",");
      const ox = Number(xs);
      const oy = Number(ys);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = ox + dx;
        const ny = oy + dy;
        const nkey = `${nx},${ny}`;
        if (seen.has(nkey)) continue;
        const cell = cellsByKey.get(nkey);
        if (!cell || cell.owner !== null || cell.river) continue;
        seen.add(nkey);
        result.push({ x: nx, y: ny, key: nkey });
      }
    }
    return result;
  }, [placementMode, myGuildId, guildsById, cellsByKey]);

  // Jump straight to wherever the eligible-tile cluster actually is the
  // moment placement mode opens - a guild's territory can grow into more
  // than one detached patch (e.g. absorbing a defeated rival's lands via
  // takeover), so "next to your territory" isn't always next to your HQ.
  // Center on the single eligible cell CLOSEST to the guild's HQ, not the
  // average of every eligible cell - averaging is wrong the moment the
  // territory is split into more than one patch, since the midpoint between
  // two separated clusters can land on empty ground touching neither one.
  // Closest-to-HQ instead always lands on a real, reachable point, and it's
  // the one most likely to still have recognizable owned territory in view.
  // Deliberately depends only on placementMode (not eligibleCells itself),
  // so this fires once on entry and never re-centers out from under the
  // player while they're already placing.
  useEffect(() => {
    if (!placementMode || eligibleCells.length === 0) return;
    const myGuild = myGuildId ? guildsById.get(myGuildId) : null;
    let target = eligibleCells[0];
    if (myGuild?.hq) {
      const [hx, hy] = myGuild.hq.split(",").map(Number);
      let bestDist = Infinity;
      for (const c of eligibleCells) {
        const d = Math.abs(c.x - hx) + Math.abs(c.y - hy);
        if (d < bestDist) {
          bestDist = d;
          target = c;
        }
      }
    }
    centerOnCell(target.x, target.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementMode]);

  const selectedCell = selectedKeep ? cellsByKey.get(selectedKeep) : null;
  const selectedOwner = selectedCell?.owner ? guildsById.get(selectedCell.owner) : null;
  const selectedKind: ResourceKind = selectedCell?.resourceKind ?? "keep";
  const selectedIsHq = selectedCell?.type === "hq";
  const selectedIsRiver = !!selectedCell?.river;
  const selectedIsBridgeBuyable =
    !!myGuildId &&
    !!selectedCell?.river &&
    selectedCell.owner === null &&
    !!selectedCell &&
    [
      `${selectedCell.x + 1},${selectedCell.y}`,
      `${selectedCell.x - 1},${selectedCell.y}`,
      `${selectedCell.x},${selectedCell.y + 1}`,
      `${selectedCell.x},${selectedCell.y - 1}`,
    ].some((n) => cellsByKey.get(n)?.owner === myGuildId);
  const selectedRank = selectedOwner ? rankedGuilds.findIndex((g) => g.id === selectedOwner.id) + 1 : 0;

  function handleBuyBridgeClick() {
    if (!selectedCell) return;
    onBuyBridge(selectedCell.x, selectedCell.y);
    closePopup();
  }

  let popupStyle: React.CSSProperties | undefined;
  if (selectedCell && anchorRect) {
    const wrapWidth = wrapRef.current?.clientWidth ?? anchorRect.left * 2;
    const wrapHeight = wrapRef.current?.clientHeight ?? anchorRect.top * 2;
    const placeOnRight = anchorRect.left < wrapWidth / 2;
    // The popup is vertically centered on `top` via `transform:
    // translateY(-50%)` (see .keep-info--floating), so it extends roughly
    // half its own height both above and below this point - clamping the
    // center to within 20px of the wrap's edge still let the box itself
    // overflow past the bottom (or top) by however much taller than 20px
    // it actually is. The popup can run to ~230px tall with a full
    // description + buff line, so the margin needs to cover half of that,
    // not just its own edge padding.
    const verticalMargin = 130;
    const top = Math.min(wrapHeight - verticalMargin, Math.max(verticalMargin, anchorRect.top + anchorRect.height / 2));
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
        className={`grid-zoom-viewport${zoom > 1 ? " grid-zoom-viewport--zoomed" : ""}${snapshot.marketOpen ? "" : " grid-zoom-viewport--night"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
      <div
        ref={gridInnerRef}
        className={`grid-view${zoom <= LOD_ZOOM_THRESHOLD ? " grid-view--far" : ""}`}
        style={{
          // minmax(0, 1fr), NOT bare 1fr: a plain `1fr` track can only shrink
          // to its content's min-content size, and several cell decorations
          // (SVG icons, resource glyphs) have a real intrinsic minimum width
          // - summed across 50+ columns that forced this grid wider than its
          // own 100%-width container on narrow screens, silently overflowing
          // the mobile viewport before any pinch/pan gesture even began.
          // `minmax(0, 1fr)` lets a track shrink all the way to 0, so all 50
          // columns actually divide the container's real width evenly - the
          // root cause of the pinch/pan math (which assumes the container IS
          // the full viewport) feeling glitchy specifically on phones.
          gridTemplateColumns: `repeat(${snapshot.gridSize}, minmax(0, 1fr))`,
          // Read panRef directly (not just `zoom` state) so a re-render
          // triggered by anything else - a fresh snapshot arriving over the
          // websocket, a zoom-state sync after a gesture - always reflects
          // the CURRENT pan instead of resetting it to (0,0) here and then
          // relying on the next pointermove to silently repair it a frame
          // later (that repair-lag is what read as "glitchy" on mobile,
          // where frames are scarcer to begin with).
          gridTemplateRows: `repeat(${snapshot.gridSize}, minmax(0, 1fr))`,
          transform: `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {cellElements}
      </div>
      {/* A second grid, laid exactly on top of the first via absolute
          positioning + the identical column/row template and transform, for
          the placement-mode dimming + eligible-tile highlights. Kept as a
          wholly separate element tree from `.grid-view` on purpose: this
          one's children list is a handful of items instead of ~2500, so
          entering/leaving placement mode never makes React reconcile
          against the big list at all - not even to append a couple of new
          items to the end of it (which still costs a pass over the full
          list). Only mounted while it actually has something to show. */}
      {placementMode && (
        <div
          ref={gridOverlayRef}
          className="grid-view-overlay"
          style={{
            gridTemplateColumns: `repeat(${snapshot.gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${snapshot.gridSize}, minmax(0, 1fr))`,
            transform: `translate(${panRef.current.x}px, ${panRef.current.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          <div className="grid-view__dim-overlay" style={{ gridColumn: "1 / -1", gridRow: "1 / -1" }} />
          {eligibleCells.map(({ x, y, key }) => (
            <div
              key={`elig-${key}`}
              className="grid-cell--place-overlay"
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              onClick={() => onPlaceTile(x, y)}
              title="Place your banked tile here"
            >
              <svg className="grid-cell__place-marker" width="42%" height="42%" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="10" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
                <rect x="3" y="10" width="18" height="4" rx="1.5" fill="currentColor" />
              </svg>
            </div>
          ))}
        </div>
      )}
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
              <span style={{ fontSize: 40 }}>{selectedIsBridgeBuyable ? "🌉" : "🌊"}</span>
            )}
          </div>
          <div>
            <h3>{selectedOwner ? "Bridge" : "River"}</h3>
            <p className="keep-info__status">
              {selectedOwner ? `Bridged by ${selectedOwner.name}` : selectedIsBridgeBuyable ? "Borders your territory" : "Impassable"}
            </p>
            <p className="keep-info__desc">
              {selectedOwner
                ? "A sturdy plank bridge, built to carry this bank's territory across."
                : "Deep, fast water - no tile bank can settle it. Buy it outright as a bridge instead, once it borders your territory."}
            </p>
            <p className="keep-info__buff">
              {selectedOwner
                ? "⚡ Claimed - this bank's territory now continues across the river here."
                : selectedIsBridgeBuyable
                  ? `⚡ Build a bridge here for ${BRIDGE_TILE_COST} silver, right now.`
                  : "⚡ The river runs on for a while yet - expand your border to reach a spot you can bridge."}
            </p>
            {selectedIsBridgeBuyable && (
              <button type="button" className="diplomacy__btn keep-info__cta" onClick={handleBuyBridgeClick}>
                🌉 Build Bridge ({BRIDGE_TILE_COST}🪙)
              </button>
            )}
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
