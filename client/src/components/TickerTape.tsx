import type { GameStateSnapshot } from "../types";

export function TickerTape({ snapshot }: { snapshot: GameStateSnapshot }) {
  const live = snapshot.guilds.filter((g) => g.hasProposal && g.proposalTicker && g.livePrice != null);
  const lastResults = snapshot.lastRoundResults.filter((r) => r.ticker && r.pctChange !== null);

  let items: string[];
  if (live.length > 0) {
    items = live.map((g) => {
      const pct = g.proposalStartPrice ? ((g.livePrice! - g.proposalStartPrice) / g.proposalStartPrice) * 100 : 0;
      const sign = pct >= 0 ? "▲" : "▼";
      const liveTag = g.liveSource === "live" ? " ●LIVE" : "";
      return `${g.name.toUpperCase()} · ${g.proposalTicker} $${g.livePrice!.toFixed(2)} ${sign} ${Math.abs(pct).toFixed(2)}%${liveTag}`;
    });
  } else if (lastResults.length > 0) {
    items = lastResults.map((r) => {
      const pct = (r.pctChange! * 100).toFixed(2);
      const sign = r.pctChange! >= 0 ? "▲" : "▼";
      return `${r.guildName.toUpperCase()} · ${r.ticker} ${sign} ${pct}%`;
    });
  } else {
    items = ["AWAITING GUILD CALLS…", `SESSION ${snapshot.sessionNumber}`, `ROUND ${snapshot.roundNumber} / ${snapshot.sessionRounds}`];
  }

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
