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
  // Set alongside "expanded"/"battle_won"/"takeover_win" when that win also
  // earned a tile - "banked" if it fit in the guild's bank, "destroyed" if
  // the bank was already full (MAX_PENDING_TILES).
  tileOutcome?: "banked" | "destroyed";
}

export interface RoundHistoryEntry {
  sessionNumber: number;
  roundNumber: number;
  results: RoundResultEntry[];
}

export interface HallOfFameEntry {
  guildId: string;
  name: string;
  color: string;
  flagDecal: string;
  tokens: number;
  sessionsWon: number;
  takeovers: number;
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
  pendingTiles: number; // banked, unplaced tiles (0..MAX_PENDING_TILES); resets each session
  hq: CellKey;
  squares: Set<CellKey>; // includes hq; reset each session
  proposal: Proposal | null;
  streaks: Record<string, number>; // consecutive battle wins vs opponent guild id
  alive: boolean; // false once absorbed via takeover
  createdAt: number;
  allies: Set<string>; // mutual non-aggression pacts; resets each session
  allianceRequestsSent: Set<string>; // guild ids this guild has proposed an alliance to, awaiting response
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
  pendingTiles: number;
  createdAt: number;
  hq: CellKey;
  squareCount: number;
  squares: CellKey[];
  hasProposal: boolean;
  alive: boolean;
  streaks: Record<string, number>;
  allies: string[];
  incomingAllianceRequests: string[]; // guild ids proposing an alliance to this guild
  outgoingAllianceRequests: string[]; // guild ids this guild has proposed to, awaiting response
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
  roundHistory: RoundHistoryEntry[];
  lastSessionWinner: { guildId: string; guildName: string } | null;
  hallOfFame: HallOfFameEntry[];
}
