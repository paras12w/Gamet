import type { GameStateSnapshot } from "../types";

export function Leaderboard({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const ranked = [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount);

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Guilds</h2>
      </div>
      <div className="leaderboard">
        {ranked.map((g, i) => (
          <div key={g.id} className={["leaderboard__row", g.id === myGuildId ? "leaderboard__row--mine" : "", !g.alive ? "leaderboard__row--dead" : ""].join(" ")}>
            <span className="leaderboard__rank">#{i + 1}</span>
            <span className="swatch" style={{ background: g.color }} />
            <span className="leaderboard__name">{g.name}</span>
            <span className="leaderboard__squares">{g.squareCount} sq</span>
            <span className="leaderboard__tokens">{g.tokens}🪙</span>
          </div>
        ))}
        {ranked.length === 0 && <div className="empty-hint">No guilds yet — be the first to found one.</div>}
      </div>
      {snapshot.lastSessionWinner && (
        <div className="last-winner">🏆 Last session won by {snapshot.lastSessionWinner.guildName}</div>
      )}
    </div>
  );
}
