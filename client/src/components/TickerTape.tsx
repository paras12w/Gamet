import type { GameStateSnapshot } from "../types";

export function TickerTape({ snapshot }: { snapshot: GameStateSnapshot }) {
  const results = snapshot.lastRoundResults.filter((r) => r.ticker && r.pctChange !== null);
  const items =
    results.length > 0
      ? results.map((r) => {
          const pct = (r.pctChange! * 100).toFixed(2);
          const sign = r.pctChange! >= 0 ? "▲" : "▼";
          return `${r.guildName.toUpperCase()} · ${r.ticker} ${sign} ${pct}%`;
        })
      : ["AWAITING GUILD CALLS…", `SESSION ${snapshot.sessionNumber}`, `ROUND ${snapshot.roundNumber} / ${snapshot.sessionRounds}`];

  const loop = [...items, ...items, ...items];

  return (
    <div className="ticker-tape">
      <div className="ticker-tape__track">
        {loop.map((text, i) => (
          <span className="ticker-tape__item" key={i}>
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
