import type { GameStateSnapshot, Identity } from "../types";
import type { GuildMenuTab } from "./GuildMenu";

export const MAX_PENDING_TILES = 5;

// Everything that used to live in scattered scrollable panels (guild info,
// scout/market, the tile bank, rankings, chat) now lives behind one row of
// buttons instead - the sidebar's only always-visible content is the timer
// and the ticker-call form (see App.tsx). Each button either opens the
// Guild Menu overlay straight to the right tab, toggles tile-placement mode
// directly, or opens the standalone Realm Chat overlay.
export function ActionBar({
  snapshot,
  identity,
  placementMode,
  onOpenMenu,
  onTogglePlacement,
  onOpenRankings,
  onOpenRealmChat,
}: {
  snapshot: GameStateSnapshot;
  identity: Identity;
  placementMode: boolean;
  onOpenMenu: (tab?: GuildMenuTab) => void;
  onTogglePlacement: () => void;
  onOpenRankings: () => void;
  onOpenRealmChat: () => void;
}) {
  const guild = snapshot.guilds.find((g) => g.id === identity.guildId);
  const isLeader = !!identity.leaderSecret;

  return (
    <div className="action-bar">
      {guild && (
        <>
          <button type="button" className="action-bar__btn" onClick={() => onOpenMenu("overview")}>
            <span className="action-bar__icon">🏰</span>Guild
          </button>
          <button type="button" className="action-bar__btn" onClick={() => onOpenMenu("scouting")}>
            <span className="action-bar__icon">🔭</span>Scout
          </button>
          <button type="button" className="action-bar__btn" onClick={() => onOpenMenu("market")}>
            <span className="action-bar__icon">🏪</span>Market
          </button>
          {isLeader && guild.pendingTiles > 0 && (
            <button type="button" className={placementMode ? "action-bar__btn action-bar__btn--active" : "action-bar__btn"} onClick={onTogglePlacement}>
              <span className="action-bar__icon">🎒</span>
              {placementMode ? "Cancel" : `Place (${guild.pendingTiles}/${MAX_PENDING_TILES})`}
            </button>
          )}
          <button type="button" className="action-bar__btn" onClick={() => onOpenMenu("forecast")}>
            <span className="action-bar__icon">📈</span>Forecast
          </button>
        </>
      )}
      <button type="button" className="action-bar__btn" onClick={onOpenRankings}>
        <span className="action-bar__icon">🏆</span>Ranks
      </button>
      <button type="button" className="action-bar__btn" onClick={onOpenRealmChat}>
        <span className="action-bar__icon">💬</span>Chat
      </button>
    </div>
  );
}
