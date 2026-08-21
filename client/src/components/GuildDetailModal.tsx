import { useEffect, useMemo } from "react";
import type { GameStateSnapshot, PublicGuild } from "../types";
import { FlagBadge } from "./icons";
import { formatCoins } from "../lib/coins";
import { bandWord } from "../lib/warband";

// How many extra tiles of grass to show around a guild's own bounding box,
// so their territory reads in context instead of a tight, disorienting crop.
const MAP_PADDING = 4;

export function GuildDetailModal({ guild, snapshot, onClose }: { guild: PublicGuild; snapshot: GameStateSnapshot; onClose: () => void }) {
  const cellsByKey = useMemo(() => new Map(snapshot.cells.map((c) => [`${c.x},${c.y}`, c])), [snapshot.cells]);
  const guildsById = useMemo(() => new Map(snapshot.guilds.map((g) => [g.id, g])), [snapshot.guilds]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const bounds = useMemo(() => {
    if (guild.squares.length === 0) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const key of guild.squares) {
      const [x, y] = key.split(",").map(Number);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return {
      minX: Math.max(0, minX - MAP_PADDING),
      maxX: Math.min(snapshot.gridSize - 1, maxX + MAP_PADDING),
      minY: Math.max(0, minY - MAP_PADDING),
      maxY: Math.min(snapshot.gridSize - 1, maxY + MAP_PADDING),
    };
  }, [guild.squares, snapshot.gridSize]);

  const snippet = useMemo(() => {
    if (!bounds) return { cols: 0, rows: 0, cells: [] as { key: string; background: string; mine: boolean }[] };
    const cells: { key: string; background: string; mine: boolean }[] = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const key = `${x},${y}`;
        const cell = cellsByKey.get(key);
        const owner = cell?.owner ? guildsById.get(cell.owner) : null;
        let background = "var(--grass-dark)";
        if (owner) background = owner.color;
        else if (cell?.river) background = "#2c5270";
        else if (cell?.type === "castle") background = "var(--gold)";
        cells.push({ key, background, mine: owner?.id === guild.id });
      }
    }
    return { cols: bounds.maxX - bounds.minX + 1, rows: bounds.maxY - bounds.minY + 1, cells };
  }, [bounds, cellsByKey, guildsById, guild.id]);

  return (
    <div className="guild-detail-overlay" onClick={onClose}>
      <div className="guild-detail" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="guild-detail__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="guild-detail__header">
          <FlagBadge color={guild.color} decal={guild.flagDecal} size={64} />
          <div>
            <h3>
              {guild.name}
              {guild.title && <span className="guild-detail__epithet">, {guild.title}</span>}
            </h3>
            <p>Led by {guild.leaderUsername}</p>
          </div>
        </div>

        {!guild.alive && <div className="badge badge--closed">Absorbed by a rival {bandWord(1, false)}.</div>}

        <div className="guild-detail__stats">
          <span>👥 {guild.members.length} member{guild.members.length === 1 ? "" : "s"}</span>
          <span>🗺️ {guild.squareCount} fields</span>
          <span>{formatCoins(guild.tokens)}</span>
          {guild.sessionsWon > 0 && <span>🏆×{guild.sessionsWon}</span>}
          {guild.takeovers > 0 && <span>👑×{guild.takeovers}</span>}
        </div>

        {guild.tagline && <p className="guild-detail__tagline">"{guild.tagline}"</p>}

        {bounds && snippet.cells.length > 0 && (
          <div className="guild-detail__map-wrap">
            <div
              className="guild-detail__map"
              style={{
                gridTemplateColumns: `repeat(${snippet.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${snippet.rows}, minmax(0, 1fr))`,
              }}
            >
              {snippet.cells.map((c) => (
                <div key={c.key} className={c.mine ? "guild-detail__cell guild-detail__cell--mine" : "guild-detail__cell"} style={{ background: c.background }} />
              ))}
            </div>
            <p className="guild-detail__map-caption">Their position on the realm map</p>
          </div>
        )}
      </div>
    </div>
  );
}
