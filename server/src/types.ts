import type { AchievementKey } from "./achievements.js";

export type CellKey = string; // `${x},${y}`

export type CellType = "empty" | "castle" | "hq";

export type ResourceKind =
  | "keep"
  | "lumber"
  | "mine"
  | "exchange"
  | "foundry" // Tech sector structure: doubles the Tech tile bonus while held
  | "vault" // Finance sector structure: passive silver interest while held
  | "refinery" // Energy sector structure: doubles the Energy silver bonus while held
  | "bandit_camp" // hostile while neutral - raids the nearest guild's silver until captured
  | "ruins" // one-time silver payout on capture, then reverts to empty land
  | "watchtower"; // free automatic scouting of guilds you're bordering (in a battle with)

export interface Cell {
  x: number;
  y: number;
  type: CellType;
  owner: string | null; // guild id
  resourceKind?: ResourceKind; // only set when type === "castle"
  river?: boolean; // unclaimable water tile; never set alongside resourceKind
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
  // earned a tile - "banked" if it fully fit in the guild's bank, "destroyed"
  // if any of it overflowed (MAX_PENDING_TILES).
  tileOutcome?: "banked" | "destroyed";
  // How many tiles this win was worth (1 normally, TOP_CALLER_TILE_BONUS for
  // the round's single best-performing call, plus any sector tile bonus) -
  // not necessarily how many actually landed in the bank if it was already
  // near full.
  tilesGranted?: number;
  // Set on a win when the called ticker belongs to a known sector/kingdom.
  sectorKey?: string;
  sectorSilverBonus?: number;
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
  scoutedBy: Set<string>; // guild ids that have paid to see this guild's call this round; resets each round
  tagline: string; // short leader-set pitch shown on the recruiting board; persists across sessions
  lastCallRound: number; // round number of the leader's last successful proposeTicker
  leaderless: boolean; // true once the leader's gone LEADER_INACTIVITY_ROUNDS without a call
  achievements: Set<AchievementKey>; // one-time unlocks; persists across sessions
  sectorWins: Record<string, number>; // wins per sector key, drives sector_specialist, specialization perks, and the council seat; resets on server restart
  currentStreak: number; // consecutive rounds this guild has won (any outcome); resets on server restart
  recentWinSectors: string[]; // last 3 sectors won in, oldest first; drives the diversification bonus; resets on server restart
  isBot: boolean; // true for an always-on AI-controlled guild; never surfaced to clients
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
  proposalTicker: string | null;
  proposalStartPrice: number | null;
  livePrice: number | null; // current tracked price for the active call, null if no active call
  liveSource: "live" | "simulated" | null;
  proposalSectorKey: string | null;
  tagline: string;
  leaderless: boolean;
  achievements: AchievementKey[];
  sectorWins: Record<string, number>;
}

export interface Wager {
  id: string;
  fromGuild: string;
  toGuild: string;
  amount: number; // in-game gold (tokens) staked by each side - not real currency
  status: "pending" | "accepted";
  settleRound: number | null; // the round number this wager resolves at, set on accept
}

export interface SectorContract {
  sectorKey: string;
  target: number;
  reward: number;
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
  wagers: Wager[];
  recentBattleCells: CellKey[];
  sectorCouncil: Record<string, string | null>; // sectorKey -> id of the guild currently leading it, if any
  activeContract: SectorContract | null;
}
