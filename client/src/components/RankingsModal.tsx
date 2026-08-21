import { useEffect } from "react";
import type { GameStateSnapshot } from "../types";
import { Leaderboard } from "./Leaderboard";
import { RoundLog } from "./RoundLog";
import { HallOfFame } from "./HallOfFame";

// A standalone overlay (not a Guild Menu tab) because rankings are realm-
// wide, not guild-specific - a spectator without a guild needs to be able
// to open this too, and the Guild Menu bails out entirely when there's no
// guild to show.
export function RankingsModal({
  snapshot,
  myGuildId,
  onClose,
}: {
  snapshot: GameStateSnapshot;
  myGuildId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="guild-menu-overlay" onClick={onClose}>
      <div className="guild-menu guild-menu--simple" onClick={(e) => e.stopPropagation()}>
        <div className="guild-menu__header">
          <div className="guild-menu__title">
            <h2>Realm Standings</h2>
            <p>Guilds, this session's battles, and the all-time Hall of Fame</p>
          </div>
          <button type="button" className="guild-menu__close" onClick={onClose} aria-label="Close rankings">
            ×
          </button>
        </div>
        <div className="guild-menu__body guild-menu__body--columns">
          <Leaderboard snapshot={snapshot} myGuildId={myGuildId} />
          <RoundLog snapshot={snapshot} />
          <HallOfFame snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}
