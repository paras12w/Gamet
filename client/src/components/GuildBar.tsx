import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { proposeTicker } from "../api";
import { soundEngine } from "../lib/sound";
import { SECTOR_INFO } from "../lib/sectors";

export const MAX_PENDING_TILES = 5;

// Deliberately just the round's ticker call now - everything else that used
// to live in this card (guild name/flag, scout/market buttons, the tile
// bank) moved to the ActionBar's buttons, per the "only the timer and the
// ticker call should be the always-visible main area" layout redesign.
// Guild name/rank/coin still shows up front and center in the Guild Menu's
// own Overview tab, one tap away via the Guild button.
export function GuildBar({ snapshot, identity }: { snapshot: GameStateSnapshot; identity: Identity }) {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  if (!guild) return null;

  const isLeader = !!identity.leaderSecret;

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
