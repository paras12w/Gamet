export interface AchievementInfo {
  name: string;
  icon: string;
  description: string;
}

// Mirrors server/src/achievements.ts ACHIEVEMENTS (minus silverReward, which
// only matters server-side when granting the achievement).
export const ACHIEVEMENT_INFO: Record<string, AchievementInfo> = {
  first_alliance: { name: "First Ally", icon: "🤝", description: "Formed your guild's first alliance." },
  first_wager_won: { name: "Lucky Gambit", icon: "🎲", description: "Won your guild's first wager." },
  first_conquest: { name: "Conqueror", icon: "👑", description: "Absorbed a rival guild for the first time." },
  win_streak_5: { name: "Unstoppable", icon: "🔥", description: "Won 5 rounds in a row." },
  sector_specialist: { name: "Sector Specialist", icon: "🎯", description: "Won 3 calls in the same kingdom sector." },
  market_patron: { name: "Market Patron", icon: "🏪", description: "Made your guild's first purchase from the Market." },
  ward_saved: { name: "Held the Line", icon: "🛡️", description: "A Palisade Ward absorbed a lost battle for the first time." },
};
