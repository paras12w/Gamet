import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { proposeTicker } from "../api";
import { FlagBadge } from "./icons";

export function GuildBar({
  snapshot,
  identity,
  onOpenMenu,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  onOpenMenu: () => void;
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to propose ticker");
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
            #{rank} · {guild.squareCount} fields · {guild.tokens}🪙
          </span>
        </span>
        <span className="guild-bar__menu-hint">Guild Menu ▸</span>
      </button>

      {isLeader ? (
        guild.hasProposal ? (
          <div className="locked-in">🔒 Your call is sealed for this round</div>
        ) : (
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
        )
      ) : (
        <div className="locked-in">Awaiting {guild.leaderUsername}'s call…</div>
      )}
    </div>
  );
}
