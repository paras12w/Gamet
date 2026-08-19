import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { proposeTicker } from "../api";
import { FlagBadge } from "./icons";
import { soundEngine } from "../lib/sound";
import { formatCoins } from "../lib/coins";
import { SECTOR_INFO } from "../lib/sectors";

export const MAX_PENDING_TILES = 5;

export function GuildBar({
  snapshot,
  identity,
  placementMode,
  onOpenMenu,
  onTogglePlacement,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  placementMode: boolean;
  onOpenMenu: () => void;
  onTogglePlacement: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  if (!guild) return null;

  const isLeader = !!identity.leaderSecret;
  const rank = [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount).findIndex((g) => g.id === guild.id) + 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!identity.leaderSecret || !guild) return;
    setSubmitting(true);
    setError(null);
    try {
      await proposeTicker(guild.id, identity.leaderSecret, ticker);
      setTicker("");
      soundEngine.play("click");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose ticker");
      soundEngine.play("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel guild-bar">
      <button type="button" className="guild-bar__header" onClick={onOpenMenu}>
        <FlagBadge color={guild.color} decal={guild.flagDecal} size={26} />
        <span className="guild-bar__title">
          <span className="guild-bar__name">{guild.name}</span>
          <span className="guild-bar__meta">
            #{rank} · {guild.squareCount} fields · {formatCoins(guild.tokens)}
          </span>
        </span>
        <span className="guild-bar__menu-hint">Guild Menu ▸</span>
      </button>

      <div className="tile-bank">
        <span className={guild.pendingTiles >= MAX_PENDING_TILES - 1 ? "tile-bank__label tile-bank__label--hot" : "tile-bank__label"}>
          🎒 Tiles banked: {guild.pendingTiles}/{MAX_PENDING_TILES}
        </span>
        {isLeader && guild.pendingTiles > 0 && (
          <button type="button" className={placementMode ? "tile-bank__place-btn tile-bank__place-btn--active" : "tile-bank__place-btn"} onClick={onTogglePlacement}>
            {placementMode ? "Cancel" : "Place a tile ▸"}
          </button>
        )}
      </div>

      {guild.hasProposal && guild.proposalTicker ? (
        <div className="locked-in locked-in--live">
          <div className="locked-in__label">🔒 Call sealed for this round</div>
          <LiveTicker
            ticker={guild.proposalTicker}
            startPrice={guild.proposalStartPrice}
            livePrice={guild.livePrice}
            source={guild.liveSource}
            sectorKey={guild.proposalSectorKey}
          />
        </div>
      ) : isLeader ? (
        <form onSubmit={submit} className="ticker-form">
          <label htmlFor="ticker">Call a ticker for this round</label>
          <div className="ticker-form__row">
            <input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              maxLength={6}
              autoComplete="off"
            />
            <button type="submit" disabled={submitting || !ticker.trim()}>
              {submitting ? "…" : "Call it"}
            </button>
          </div>
          {error && <div className="form-error">{error}</div>}
        </form>
      ) : (
        <div className="locked-in">Awaiting {guild.leaderUsername}'s call…</div>
      )}
    </div>
  );
}

export function LiveTicker({
  ticker,
  startPrice,
  livePrice,
  source,
  sectorKey,
}: {
  ticker: string;
  startPrice: number | null;
  livePrice: number | null;
  source: "live" | "simulated" | null;
  sectorKey?: string | null;
}) {
  const pct = livePrice != null && startPrice ? (livePrice - startPrice) / startPrice : null;
  const up = pct !== null && pct >= 0;
  const sector = sectorKey ? SECTOR_INFO[sectorKey] : null;
  return (
    <div className="live-ticker">
      <span className="live-ticker__symbol">{ticker}</span>
      {sector && (
        <span className="live-ticker__sector" title={`${sector.name} kingdom`}>
          {sector.icon} {sector.name}
        </span>
      )}
      {livePrice != null ? (
        <>
          <span className="live-ticker__price">${livePrice.toFixed(2)}</span>
          {pct !== null && (
            <span className={up ? "pct pct--up" : "pct pct--down"}>
              {up ? "▲" : "▼"} {(Math.abs(pct) * 100).toFixed(2)}%
            </span>
          )}
          <span className={source === "live" ? "live-ticker__badge live-ticker__badge--live" : "live-ticker__badge"}>
            {source === "live" ? "● LIVE" : "○ SIM"}
          </span>
        </>
      ) : (
        <span className="live-ticker__price">fetching…</span>
      )}
    </div>
  );
}
