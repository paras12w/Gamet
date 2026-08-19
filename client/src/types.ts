// Reserved chat channel id for the realm-wide chat (mirrors server's GLOBAL_CHAT_ID).
export const GLOBAL_CHAT_ID = "global";

export type CellType = "empty" | "castle" | "hq";

export type ResourceKind = "keep" | "lumber" | "mine";

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  owner: string | null;
  resourceKind?: ResourceKind;
}

export interface Battle {
  id: string;
  guildA: string;
  guildB: string;
  cellA: string;
  cellB: string;
  createdRound: number;
}

export type RoundOutcome =
  | "expanded"
  | "no_change"
  | "battle_won"
  | "battle_lost"
  | "battle_tied"
  | "battle_forfeit"
  | "no_proposal"
  | "takeover_win"
  | "takeover_lost";

export type TileOutcome = "banked" | "destroyed";

export interface RoundResultEntry {
  guildId: string;
  guildName: string;
  ticker: string | null;
  startPrice: number | null;
  endPrice: number | null;
  pctChange: number | null;
  outcome: RoundOutcome;
  tileOutcome?: TileOutcome;
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
  hq: string;
  squareCount: number;
  squares: string[];
  hasProposal: boolean;
  alive: boolean;
  streaks: Record<string, number>;
  allies: string[];
  incomingAllianceRequests: string[];
  outgoingAllianceRequests: string[];
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

export interface Identity {
  username: string;
  guildId: string | null;
  leaderSecret: string | null;
  rulesSeen: boolean;
  spectating?: boolean;
}

export interface FlagOptions {
  colors: string[];
  decals: string[];
}

export interface ChatMessage {
  id: string;
  guildId: string;
  username: string;
  text: string;
  at: number;
}
