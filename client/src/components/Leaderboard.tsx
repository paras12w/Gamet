import { useState } from "react";
import type { GameStateSnapshot, PublicGuild } from "../types";
import { FlagBadge } from "./icons";
import { formatCoins } from "../lib/coins";
import { GuildDetailModal } from "./GuildDetailModal";

export function Leaderboard({ snapshot, myGuildId }: { snapshot: GameStateSnapshot; myGuildId: string | null }) {
  const ranked = [...snapshot.guilds].sort((a, b) => b.squareCount - a.squareCount);
  const [selected, setSelected] = useState<PublicGuild | null>(null);

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Guilds of the Realm</h2>
      </div>
      <div className="leaderboard">
        {ranked.map((g, i) => (
          <button
            type="button"
            key={g.id}
            className={["leaderboard__row", g.id === myGuildId ? "leaderboard__row--mine" : "", !g.alive ? "leaderboard__row--dead" : ""].join(" ")}
            onClick={() => setSelected(g)}
          >
            <span className="leaderboard__rank">#{i + 1}</span>
            <FlagBadge color={g.color} decal={g.flagDecal} size={20} />
            <span className="leaderboard__name">
              {g.name}
              {g.title && <span className="leaderboard__epithet">, {g.title}</span>}
            </span>
            <span className="leaderboard__squares">{g.squareCount} fields</span>
            <span className="leaderboard__tokens">{formatCoins(g.tokens)}</span>
          </button>
        ))}
        {ranked.length === 0 && <div className="empty-hint">No guilds yet — be the first to found one.</div>}
      </div>
      {snapshot.lastSessionWinner && (
        <div className="last-winner">🏆 Last season's crown went to {snapshot.lastSessionWinner.guildName}</div>
      )}
      {selected && <GuildDetailModal guild={selected} snapshot={snapshot} onClose={() => setSelected(null)} />}
    </div>
  );
}
