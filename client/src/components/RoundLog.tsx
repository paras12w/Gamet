import type { GameStateSnapshot, RoundResultEntry } from "../types";

const OUTCOME_LABEL: Record<RoundResultEntry["outcome"], string> = {
  expanded: "📈 expanded territory",
  no_change: "flat — no expansion",
  battle_won: "⚔️ won the border battle",
  battle_lost: "⚔️ lost the border battle",
  battle_tied: "⚔️ battle tied — no capture",
  battle_forfeit: "⚔️ forfeited the battle (no call)",
  no_proposal: "sat out this round",
  takeover_win: "👑 TAKEOVER — absorbed the enemy guild!",
  takeover_lost: "💀 absorbed by the enemy guild",
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
              <span className="round-log__outcome">{OUTCOME_LABEL[r.outcome]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
