import type { GameStateSnapshot, RoundResultEntry } from "../types";

const OUTCOME_LABEL: Record<RoundResultEntry["outcome"], string> = {
  expanded: "🌱 claimed new ground",
  no_change: "held their ground — no gain",
  battle_won: "⚔️ won the duel",
  battle_lost: "⚔️ lost the duel",
  battle_tied: "⚔️ duel tied — no ground taken",
  battle_forfeit: "⚔️ forfeited the duel (no call)",
  no_proposal: "sat out this round",
  takeover_win: "👑 CONQUEST — the rival guild falls!",
  takeover_lost: "💀 conquered by a rival guild",
};

const TILE_OUTCOME_LABEL: Record<"banked" | "destroyed", string> = {
  banked: " · 🎒 tile banked",
  destroyed: " · 🔥 tile destroyed (bank full)",
};

export function RoundLog({ snapshot }: { snapshot: GameStateSnapshot }) {
  const entries = snapshot.lastRoundResults;

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Last Round</h2>
      </div>
      <div className="round-log">
        {entries.length === 0 && <div className="empty-hint">Results appear once the first round resolves.</div>}
        {entries.map((r, i) => {
          const up = r.pctChange !== null && r.pctChange >= 0;
          return (
            <div key={i} className="round-log__row">
              <span className="round-log__guild">{r.guildName}</span>
              {r.ticker && (
                <span className={up ? "pct pct--up" : "pct pct--down"}>
                  {r.ticker} {up ? "▲" : "▼"} {(Math.abs(r.pctChange ?? 0) * 100).toFixed(2)}%
                </span>
              )}
              <span className="round-log__outcome">
                {OUTCOME_LABEL[r.outcome]}
                {r.tileOutcome && TILE_OUTCOME_LABEL[r.tileOutcome]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
