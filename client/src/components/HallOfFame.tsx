import type { GameStateSnapshot } from "../types";
import { FlagBadge } from "./icons";
import { formatCoins } from "../lib/coins";

export function HallOfFame({ snapshot }: { snapshot: GameStateSnapshot }) {
  const entries = snapshot.hallOfFame;

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Hall of Fame</h2>
      </div>
      <div className="hall-of-fame">
        {entries.length === 0 && <div className="empty-hint">No legends yet — win a season to be remembered.</div>}
        {entries.map((e, i) => (
          <div key={e.guildId} className="hall-of-fame__row">
            <span className="hall-of-fame__rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
            <FlagBadge color={e.color} decal={e.flagDecal} size={20} />
            <span className="hall-of-fame__name">{e.name}</span>
            <span className="hall-of-fame__stats">
              {formatCoins(e.tokens)} · {e.sessionsWon}🏆 · {e.takeovers}👑
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
