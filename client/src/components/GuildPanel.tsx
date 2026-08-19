import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { proposeTicker } from "../api";
import { FlagBadge } from "./icons";

export function GuildPanel({
  snapshot,
  identity,
  onLeave,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  onLeave: () => void;
}) {
  const [ticker, setTicker] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  if (!guild) return null;

  const isLeader = !!identity.leaderSecret;
  const streakEntries = Object.entries(guild.streaks).filter(([, v]) => v > 0);
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
    <div className="panel guild-panel">
      <div className="panel__header">
        <FlagBadge color={guild.color} decal={guild.flagDecal} size={26} />
        <h2>{guild.name}</h2>
        {!guild.alive && <span className="badge badge--closed">ABSORBED</span>}
      </div>
      <div className="guild-panel__stats">
        <div>
          <span className="stat-label">Rank</span>
          <span className="stat-value">#{rank}</span>
        </div>
        <div>
          <span className="stat-label">Fields</span>
          <span className="stat-value">{guild.squareCount}</span>
        </div>
        <div>
          <span className="stat-label">Gold</span>
          <span className="stat-value">{guild.tokens}</span>
        </div>
        <div>
          <span className="stat-label">Members</span>
          <span className="stat-value">{guild.members.length}</span>
        </div>
      </div>
      <div className="guild-panel__leader">Leader: {guild.leaderUsername}</div>

      {streakEntries.length > 0 && (
        <div className="guild-panel__streaks">
          {streakEntries.map(([oppId, v]) => {
            const opp = snapshot.guilds.find((g) => g.id === oppId);
            return (
              <div key={oppId} className="streak-row">
                ⚔ {v} duel win{v > 1 ? "s" : ""} vs {opp?.name ?? "unknown"} <span className="streak-warn">(conquest at 2)</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="guild-panel__action">
        {isLeader ? (
          guild.hasProposal ? (
            <div className="locked-in">🔒 Your call is sealed for this round</div>
          ) : (
            <form onSubmit={submit} className="ticker-form">
              <label htmlFor="ticker">Call a ticker for this round</label>
              <p className="ticker-form__hint">A rising call grows your lands by one field.</p>
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

      <button className="link-button" onClick={onLeave}>
        Abandon this banner
      </button>
    </div>
  );
}
