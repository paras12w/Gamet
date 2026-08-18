import { useState } from "react";
import type { GameStateSnapshot, Identity } from "../types";
import { proposeTicker } from "../api";

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
        <span className="swatch" style={{ background: guild.color }} />
        <h2>{guild.name}</h2>
        {!guild.alive && <span className="badge badge--closed">ABSORBED</span>}
      </div>
      <div className="guild-panel__stats">
        <div>
          <span className="stat-label">Squares</span>
          <span className="stat-value">{guild.squareCount}</span>
        </div>
        <div>
          <span className="stat-label">Tokens</span>
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
                ⚔ {v} win streak vs {opp?.name ?? "unknown"} {v >= 1 && <span className="streak-warn">(takeover at 2)</span>}
              </div>
            );
          })}
        </div>
      )}

      <div className="guild-panel__action">
        {isLeader ? (
          guild.hasProposal ? (
            <div className="locked-in">🔒 Ticker locked in for this round</div>
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
          <div className="locked-in">Waiting on {guild.leaderUsername} to call a stock…</div>
        )}
      </div>

      <button className="link-button" onClick={onLeave}>
        Switch guild
      </button>
    </div>
  );
}
