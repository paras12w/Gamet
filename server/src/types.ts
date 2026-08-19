export type CellKey = string; // `${x},${y}`

export type CellType = "empty" | "castle" | "hq";

export type ResourceKind = "keep" | "lumber" | "mine";

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  owner: string | null; // guild id
  resourceKind?: ResourceKind; // only set when type === "castle"
}

export interface ChatMessage {
  id: string;
  guildId: string;
  username: string;
  text: string;
  at: number;
}

export interface Proposal {
  ticker: string;
  startPrice: number;
  submittedAt: number;
}

export interface Battle {
  id: string;
  guildA: string;
  guildB: string;
  // The specific bordering cell owned by each guild that is at stake.
  cellA: CellKey;
  cellB: CellKey;
  createdRound: number;
}

export interface RoundResultEntry {
  guildId: string;
  guildName: string;
  ticker: string | null;
  startPrice: number | null;
  endPrice: number | null;
  pctChange: number | null;
  outcome:
    | "expanded"
    | "no_change"
    | "battle_won"
    | "battle_lost"
    | "battle_tied"
    | "battle_forfeit"
    | "no_proposal"
    | "takeover_win"
    | "takeover_lost";
}

export interface Guild {
  id: string;
  name: string;
  leaderUsername: string;
  leaderSecret: string; // simple bearer-style token the leader holds to authenticate
  members: string[];
  color: string; // flag background color
  flagDecal: string; // flag emblem (one of FLAG_DECALS)
  tokens: number; // persists across sessions
  sessionsWon: number; // persists across sessions
  takeovers: number; // persists across sessions
  hq: CellKey;
  squares: Set<CellKey>; // includes hq; reset each session
  proposal: Proposal | null;
  streaks: Record<string, number>; // consecutive battle wins vs opponent guild id
  alive: boolean; // false once absorbed via takeover
  createdAt: number;
}

export interface PublicGuild {
  id: string;
  name: string;
  leaderUsername: string;
  members: string[];
  color: string;
  flagDecal: string;
  tokens: number;
  sessionsWon: number;
  takeovers: number;
  createdAt: number;
  hq: CellKey;
  squareCount: number;
  squares: CellKey[];
  hasProposal: boolean;
  alive: boolean;
  streaks: Record<string, number>;
}

export interface GameStateSnapshot {
  gridSize: number;
  cells: Cell[];
  guilds: PublicGuild[];
  battles: Battle[];
  roundNumber: number;
  sessionNumber: number;
  sessionRounds: number;
  roundStartedAt: number;
  roundEndsAt: number;
  marketOpen: boolean;
  lastRoundResults: RoundResultEntry[];
  lastSessionWinner: { guildId: string; guildName: string } | null;
}
