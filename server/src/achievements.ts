export type AchievementKey =
  | "first_alliance"
  | "first_wager_won"
  | "first_conquest"
  | "win_streak_5"
  | "sector_specialist"
  | "market_patron"
  | "ward_saved";

export interface AchievementInfo {
  key: AchievementKey;
  name: string;
  icon: string;
  description: string;
  silverReward: number;
}

export const ACHIEVEMENTS: Record<AchievementKey, AchievementInfo> = {
  first_alliance: {
    key: "first_alliance",
    name: "First Ally",
    icon: "🤝",
    description: "Formed your guild's first alliance.",
    silverReward: 5,
  },
  first_wager_won: {
    key: "first_wager_won",
    name: "Lucky Gambit",
    icon: "🎲",
    description: "Won your guild's first wager.",
    silverReward: 5,
  },
  first_conquest: {
    key: "first_conquest",
    name: "Conqueror",
    icon: "👑",
    description: "Absorbed a rival guild for the first time.",
    silverReward: 10,
  },
  win_streak_5: {
    key: "win_streak_5",
    name: "Unstoppable",
    icon: "🔥",
    description: "Won 5 rounds in a row.",
    silverReward: 10,
  },
  sector_specialist: {
    key: "sector_specialist",
    name: "Sector Specialist",
    icon: "🎯",
    description: "Won 3 calls in the same kingdom sector.",
    silverReward: 10,
  },
  market_patron: {
    key: "market_patron",
    name: "Market Patron",
    icon: "🏪",
    description: "Made your guild's first purchase from the Market.",
    silverReward: 5,
  },
  ward_saved: {
    key: "ward_saved",
    name: "Held the Line",
    icon: "🛡️",
    description: "A Palisade Ward absorbed a lost battle for the first time.",
    silverReward: 8,
  },
};
