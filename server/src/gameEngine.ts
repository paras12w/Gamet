import { randomBytes, randomUUID } from "node:crypto";
import { CHAT_HISTORY_LIMIT, CONFIG, FLAG_COLORS, FLAG_DECALS, GLOBAL_CHAT_ID, NEUTRAL_CASTLE_COUNT, NEUTRAL_MIN_SPACING } from "./config.js";
import {
  blockCells,
  blockInBounds,
  cellKey,
  chebyshevDistance,
  generateRivers,
  inBounds,
  isNearCenter,
  neighborsOf,
  parseKey,
  scatterNeutralPositions,
} from "./grid.js";
import { isMarketOpen, priceEngine } from "./priceEngine.js";
import { SECTOR_SILVER_BONUS, SECTOR_TILE_BONUS, SECTORS, sectorForTicker } from "./sectors.js";
import { ACHIEVEMENTS, type AchievementKey } from "./achievements.js";
import {
  getTopGuildsByTokens,
  insertGuildRow,
  loadAllGuildRows,
  recordSessionResult,
  updateGuildAchievements,
  updateGuildLeader,
  updateGuildMembers,
  updateGuildSessionsWon,
  updateGuildTagline,
  updateGuildTakeovers,
  updateGuildTokens,
} from "./db.js";
import type {
  Battle,
  Cell,
  CellKey,
  ChatMessage,
  GameStateSnapshot,
  Guild,
  HallOfFameEntry,
  PublicGuild,
  ResourceKind,
  RoundHistoryEntry,
  RoundResultEntry,
  Wager,
} from "./types.js";

// The three sectors with an actual per-call bonus (see sectors.ts) - the
// ones specialization, the council seat, and rotating contracts all revolve
// around. Index/Consumer/Industrial tickers still classify for display but
// don't feed these deeper systems.
const KINGDOM_SECTORS = ["tech", "finance", "energy"] as const;

// Relative weights for neutral castle kinds: the classics are common, the
// sector structures and Market Exchange show up less often, and the most
// impactful specials (Bandit Camp, Watchtower, Ruins) are rarer still.
const RESOURCE_WEIGHTS: [ResourceKind, number][] = [
  ["keep", 6],
  ["lumber", 6],
  ["mine", 6],
  ["exchange", 4],
  ["foundry", 3],
  ["vault", 3],
  ["refinery", 3],
  ["ruins", 3],
  ["bandit_camp", 2],
  ["watchtower", 2],
];
const RESOURCE_WEIGHT_TOTAL = RESOURCE_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function randomToken(): string {
  return randomBytes(24).toString("hex");
}

function randomFlagColor(): string {
  return FLAG_COLORS[Math.floor(Math.random() * FLAG_COLORS.length)];
}

function randomFlagDecal(): string {
  return FLAG_DECALS[Math.floor(Math.random() * FLAG_DECALS.length)];
}

function randomResourceKind(): ResourceKind {
  let roll = Math.random() * RESOURCE_WEIGHT_TOTAL;
  for (const [kind, weight] of RESOURCE_WEIGHTS) {
    if (roll < weight) return kind;
    roll -= weight;
  }
  return "keep";
}

export class GameEngine {
  private grid = new Map<CellKey, Cell>();
  private guilds = new Map<string, Guild>();
  private battles: Battle[] = [];
  private castles: CellKey[] = [];
  private rivers = new Set<CellKey>();
  roundNumber = 1;
  sessionNumber = 1;
  roundStartedAt = Date.now();
  roundEndsAt = Date.now() + CONFIG.ROUND_DURATION_MS;
  lastRoundResults: RoundResultEntry[] = [];
  roundHistory: RoundHistoryEntry[] = [];
  lastSessionWinner: { guildId: string; guildName: string } | null = null;
  wagers: Wager[] = [];
  recentBattleCells: CellKey[] = [];
  private sectorCouncil: Record<string, string | null> = {};
  private activeContract: { sectorKey: string; target: number; reward: number; progress: Record<string, number> } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chats = new Map<string, ChatMessage[]>();
  onUpdate: (() => void) | null = null;
  onChatMessage: ((message: ChatMessage) => void) | null = null;

  constructor() {
    this.initGrid();
    this.restoreGuildsFromDb();
    this.rollNewContract();
    this.scheduleNextRound();
  }

  private rollNewContract(): void {
    const sectorKey = KINGDOM_SECTORS[Math.floor(Math.random() * KINGDOM_SECTORS.length)];
    this.activeContract = { sectorKey, target: CONFIG.CONTRACT_TARGET, reward: CONFIG.CONTRACT_REWARD, progress: {} };
  }

  // ---------- setup ----------

  private initGrid(): void {
    this.grid.clear();
    this.rivers = generateRivers(CONFIG.RIVER_COUNT);
    this.castles = scatterNeutralPositions(NEUTRAL_CASTLE_COUNT, NEUTRAL_MIN_SPACING, this.rivers);
    const castleSet = new Set(this.castles);
    for (let x = 0; x < CONFIG.GRID_SIZE; x++) {
      for (let y = 0; y < CONFIG.GRID_SIZE; y++) {
        const key = cellKey(x, y);
        const isCastle = castleSet.has(key);
        this.grid.set(key, {
          x,
          y,
          type: isCastle ? "castle" : "empty",
          owner: null,
          resourceKind: isCastle ? randomResourceKind() : undefined,
          river: this.rivers.has(key) || undefined,
        });
      }
    }
  }

  /** True if any orthogonal neighbor of `key` is a river tile - used for the
   * riverside fertility bonus on held resource castles. */
  private isRiverside(key: CellKey): boolean {
    return neighborsOf(key).some((n) => this.rivers.has(n));
  }

  private restoreGuildsFromDb(): void {
    const rows = loadAllGuildRows();
    for (const row of rows) {
      const guild: Guild = {
        id: row.id,
        name: row.name,
        leaderUsername: row.leader_username,
        leaderSecret: row.leader_secret,
        members: JSON.parse(row.members),
        color: row.color,
        flagDecal: row.flag_decal,
        tokens: row.tokens,
        sessionsWon: row.sessions_won,
        takeovers: row.takeovers,
        pendingTiles: 0,
        hq: cellKey(0, 0), // overwritten by placeHq below
        squares: new Set(),
        proposal: null,
        streaks: {},
        alive: true,
        createdAt: row.created_at,
        allies: new Set(),
        allianceRequestsSent: new Set(),
        scoutedBy: new Set(),
        tagline: row.tagline,
        lastCallRound: this.roundNumber,
        leaderless: false,
        achievements: new Set(JSON.parse(row.achievements) as AchievementKey[]),
        sectorWins: {},
        currentStreak: 0,
        recentWinSectors: [],
      };
      this.guilds.set(guild.id, guild);
      this.placeHq(guild);
    }
  }

  /** Reserves a free 2x2 block for the guild's castle and marks it owned. */
  private placeHq(guild: Guild): void {
    const block = this.pickHqBlock(guild.id);
    guild.hq = block[0]; // top-left corner is the "primary" cell the client renders the big icon on
    guild.squares = new Set(block);
    for (const key of block) {
      const cell = this.grid.get(key)!;
      cell.type = "hq";
      cell.owner = guild.id;
    }
  }

  private pickHqBlock(excludeGuildId?: string): CellKey[] {
    const existingHqs = [...this.guilds.values()].filter((g) => g.id !== excludeGuildId).map((g) => g.hq);
    const isFreeBlock = (x: number, y: number) => {
      if (!blockInBounds(x, y)) return false;
      return blockCells(x, y).every((key) => {
        const cell = this.grid.get(key);
        return !!cell && cell.type !== "castle" && cell.owner === null && !cell.river;
      });
    };
    let minDistance = CONFIG.MIN_HQ_DISTANCE;
    for (let attempt = 0; attempt < 500; attempt++) {
      if (attempt === 250) minDistance = Math.max(1, Math.floor(minDistance / 2));
      const x = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 1));
      const y = Math.floor(Math.random() * (CONFIG.GRID_SIZE - 1));
      if (isNearCenter(x + 0.5, y + 0.5)) continue; // keep the map's middle as contested, unowned ground
      if (!isFreeBlock(x, y)) continue;
      const key = cellKey(x, y);
      if (existingHqs.every((hq) => chebyshevDistance(hq, key) >= minDistance)) return blockCells(x, y);
    }
    // Grid saturated - fall back to any free block.
    for (let x = 0; x < CONFIG.GRID_SIZE - 1; x++) {
      for (let y = 0; y < CONFIG.GRID_SIZE - 1; y++) {
        if (isFreeBlock(x, y)) return blockCells(x, y);
      }
    }
    return blockCells(0, 0);
  }

  // ---------- guild lifecycle ----------

  createGuild(
    name: string,
    leaderUsername: string,
    flagColor?: string,
    flagDecal?: string
  ): { guild: Guild; secret: string } {
    const secret = randomToken();
    const guild: Guild = {
      id: randomUUID(),
      name: name.trim().slice(0, 40),
      leaderUsername: leaderUsername.trim().slice(0, 30),
      leaderSecret: secret,
      members: [leaderUsername.trim().slice(0, 30)],
      color: flagColor && FLAG_COLORS.includes(flagColor) ? flagColor : randomFlagColor(),
      flagDecal: flagDecal && FLAG_DECALS.includes(flagDecal) ? flagDecal : randomFlagDecal(),
      tokens: 0,
      sessionsWon: 0,
      takeovers: 0,
      pendingTiles: 0,
      hq: cellKey(0, 0), // overwritten by placeHq below
      squares: new Set(),
      proposal: null,
      streaks: {},
      alive: true,
      createdAt: Date.now(),
      allies: new Set(),
      allianceRequestsSent: new Set(),
      scoutedBy: new Set(),
      tagline: "",
      lastCallRound: this.roundNumber,
      leaderless: false,
      achievements: new Set(),
      sectorWins: {},
      currentStreak: 0,
      recentWinSectors: [],
    };
    this.guilds.set(guild.id, guild);
    this.placeHq(guild);

    insertGuildRow({
      id: guild.id,
      name: guild.name,
      leader_username: guild.leaderUsername,
      leader_secret: guild.leaderSecret,
      color: guild.color,
      flag_decal: guild.flagDecal,
      members: JSON.stringify(guild.members),
      tokens: guild.tokens,
      sessions_won: guild.sessionsWon,
      takeovers: guild.takeovers,
      tagline: guild.tagline,
      achievements: JSON.stringify([]),
      created_at: guild.createdAt,
    });

    this.emitUpdate();
    return { guild, secret };
  }

  joinGuild(guildId: string, username: string): Guild | null {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return null;
    const clean = username.trim().slice(0, 30);
    if (clean && !guild.members.includes(clean)) {
      guild.members.push(clean);
      updateGuildMembers(guild.id, guild.members);
    }
    this.emitUpdate();
    return guild;
  }

  // ---------- guild chat ----------

  getChatHistory(guildId: string): ChatMessage[] {
    return this.chats.get(guildId) ?? [];
  }

  // Posts to any channel key with no existence check - used for real guild
  // ids, the reserved global channel, and synthetic alliance-pair keys alike.
  private postChatMessageRaw(channelId: string, username: string, text: string): ChatMessage | null {
    const cleanText = text.trim().slice(0, 300);
    if (!cleanText) return null;
    const message: ChatMessage = {
      id: randomUUID(),
      guildId: channelId,
      username: username.trim().slice(0, 30) || "Unknown",
      text: cleanText,
      at: Date.now(),
    };
    const history = this.chats.get(channelId) ?? [];
    history.push(message);
    if (history.length > CHAT_HISTORY_LIMIT) history.shift();
    this.chats.set(channelId, history);
    this.onChatMessage?.(message);
    return message;
  }

  postChatMessage(guildId: string, username: string, text: string): ChatMessage | null {
    const isGlobal = guildId === GLOBAL_CHAT_ID;
    if (!isGlobal && !this.guilds.get(guildId)) return null;
    return this.postChatMessageRaw(guildId, username, text);
  }

  private postSystemMessage(guildId: string, text: string): void {
    this.postChatMessageRaw(guildId, "📯 Herald", text);
  }

  // ---------- guild alliances ----------

  private areAllied(a: string, b: string): boolean {
    return !!this.guilds.get(a)?.allies.has(b);
  }

  private allianceChatKey(a: string, b: string): string {
    return `alliance:${[a, b].sort().join("|")}`;
  }

  getAllianceChatHistory(guildId: string, allyGuildId: string): ChatMessage[] | null {
    if (!this.areAllied(guildId, allyGuildId)) return null;
    return this.getChatHistory(this.allianceChatKey(guildId, allyGuildId));
  }

  postAllianceMessage(guildId: string, allyGuildId: string, username: string, text: string): ChatMessage | null {
    if (!this.areAllied(guildId, allyGuildId)) return null;
    return this.postChatMessageRaw(this.allianceChatKey(guildId, allyGuildId), username, text);
  }

  proposeAlliance(guildId: string, leaderSecret: string, targetGuildId: string): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    const target = this.guilds.get(targetGuildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can propose an alliance" };
    if (!target || !target.alive) return { ok: false, error: "Target guild not found" };
    if (target.id === guild.id) return { ok: false, error: "A guild cannot ally with itself" };
    if (guild.allies.has(target.id)) return { ok: false, error: "Already allied with that guild" };
    if (guild.allianceRequestsSent.has(target.id)) return { ok: false, error: "Alliance already proposed" };
    guild.allianceRequestsSent.add(target.id);
    this.postSystemMessage(guild.id, `⚜️ We have proposed an alliance with ${target.name}.`);
    this.postSystemMessage(target.id, `⚜️ ${guild.name} has proposed an alliance with us. Respond in the Diplomacy tab.`);
    this.emitUpdate();
    return { ok: true };
  }

  respondAlliance(
    guildId: string,
    leaderSecret: string,
    proposerGuildId: string,
    accept: boolean
  ): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    const proposer = this.guilds.get(proposerGuildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can respond to alliances" };
    if (!proposer || !proposer.allianceRequestsSent.has(guild.id)) return { ok: false, error: "No pending alliance request from that guild" };
    proposer.allianceRequestsSent.delete(guild.id);
    if (accept) {
      guild.allies.add(proposer.id);
      proposer.allies.add(guild.id);
      this.battles = this.battles.filter((b) => !(b.guildA === guild.id && b.guildB === proposer.id) && !(b.guildA === proposer.id && b.guildB === guild.id));
      this.postSystemMessage(guild.id, `🤝 An alliance has been formed with ${proposer.name}!`);
      this.postSystemMessage(proposer.id, `🤝 An alliance has been formed with ${guild.name}!`);
      this.awardAchievement(guild, "first_alliance");
      this.awardAchievement(proposer, "first_alliance");
    } else {
      this.postSystemMessage(guild.id, `⚔️ We have declined ${proposer.name}'s alliance offer.`);
      this.postSystemMessage(proposer.id, `⚔️ ${guild.name} has declined our alliance offer.`);
    }
    this.emitUpdate();
    return { ok: true };
  }

  breakAlliance(guildId: string, leaderSecret: string, allyGuildId: string): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    const ally = this.guilds.get(allyGuildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can break an alliance" };
    if (!ally || !guild.allies.has(ally.id)) return { ok: false, error: "Not allied with that guild" };
    guild.allies.delete(ally.id);
    ally.allies.delete(guild.id);
    this.postSystemMessage(guild.id, `💔 We have broken our alliance with ${ally.name}.`);
    this.postSystemMessage(ally.id, `💔 ${guild.name} has broken our alliance.`);
    this.emitUpdate();
    return { ok: true };
  }

  // ---------- guild wagers (in-game gold only, not real currency) ----------

  proposeWager(guildId: string, leaderSecret: string, targetGuildId: string, amount: number): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    const target = this.guilds.get(targetGuildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can propose a wager" };
    if (!target || !target.alive) return { ok: false, error: "Target guild not found" };
    if (target.id === guild.id) return { ok: false, error: "A guild cannot wager against itself" };
    if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: "Wager amount must be a positive whole number of gold" };
    if (amount > guild.tokens) return { ok: false, error: "You don't have that much gold" };
    const existing = this.wagers.some(
      (w) => w.status === "pending" && ((w.fromGuild === guild.id && w.toGuild === target.id) || (w.fromGuild === target.id && w.toGuild === guild.id))
    );
    if (existing) return { ok: false, error: "There is already a pending wager between these guilds" };
    this.wagers.push({ id: randomUUID(), fromGuild: guild.id, toGuild: target.id, amount, status: "pending", settleRound: null });
    this.postSystemMessage(guild.id, `🪙 We have challenged ${target.name} to a ${amount}-gold wager on this round's calls.`);
    this.postSystemMessage(target.id, `🪙 ${guild.name} has challenged us to a ${amount}-gold wager on this round's calls. Respond in the Wagers tab.`);
    this.emitUpdate();
    return { ok: true };
  }

  respondWager(guildId: string, leaderSecret: string, wagerId: string, accept: boolean): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can respond to a wager" };
    const wager = this.wagers.find((w) => w.id === wagerId && w.toGuild === guildId && w.status === "pending");
    if (!wager) return { ok: false, error: "No pending wager found" };
    const from = this.guilds.get(wager.fromGuild);
    if (!from) return { ok: false, error: "Challenger no longer exists" };
    if (accept) {
      if (guild.tokens < wager.amount) return { ok: false, error: "You don't have enough gold to cover this wager" };
      wager.status = "accepted";
      wager.settleRound = this.roundNumber;
      this.postSystemMessage(guild.id, `🪙 Wager accepted - ${wager.amount} gold rides on this round's calls against ${from.name}.`);
      this.postSystemMessage(from.id, `🪙 ${guild.name} accepted our wager - ${wager.amount} gold rides on this round's calls.`);
    } else {
      this.wagers = this.wagers.filter((w) => w.id !== wagerId);
      this.postSystemMessage(guild.id, `🪙 We declined ${from.name}'s wager.`);
      this.postSystemMessage(from.id, `🪙 ${guild.name} declined our wager.`);
    }
    this.emitUpdate();
    return { ok: true };
  }

  cancelWager(guildId: string, leaderSecret: string, wagerId: string): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can cancel a wager" };
    const wager = this.wagers.find((w) => w.id === wagerId && w.fromGuild === guildId && w.status === "pending");
    if (!wager) return { ok: false, error: "No pending wager found to cancel" };
    this.wagers = this.wagers.filter((w) => w.id !== wagerId);
    const target = this.guilds.get(wager.toGuild);
    if (target) this.postSystemMessage(target.id, `🪙 ${guild.name} withdrew their wager challenge.`);
    this.emitUpdate();
    return { ok: true };
  }

  // ---------- scouting ----------

  /** Pay SCOUT_COST silver to reveal a rival's locked-in call for the rest
   * of this round - their ticker, price, and sector become visible to you
   * (and only you) via toPublicGuild's redaction check. */
  scoutGuild(guildId: string, leaderSecret: string, targetGuildId: string): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    const target = this.guilds.get(targetGuildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can scout" };
    if (!target || !target.alive) return { ok: false, error: "Target guild not found" };
    if (target.id === guild.id) return { ok: false, error: "Cannot scout your own guild" };
    if (!target.proposal) return { ok: false, error: "That guild hasn't called a ticker yet this round" };
    if (target.scoutedBy.has(guild.id)) return { ok: false, error: "You've already scouted that guild this round" };
    const scoutCost = Math.max(1, CONFIG.SCOUT_COST - (this.holdsAnyCouncilSeat(guild.id) ? CONFIG.COUNCIL_SCOUT_DISCOUNT : 0));
    if (guild.tokens < scoutCost) return { ok: false, error: "Not enough silver to scout" };
    guild.tokens -= scoutCost;
    updateGuildTokens(guild.id, guild.tokens);
    target.scoutedBy.add(guild.id);
    this.postSystemMessage(
      guild.id,
      `🔭 Scouted ${target.name} — calling ${target.proposal.ticker} at $${target.proposal.startPrice.toFixed(2)}.`
    );
    this.emitUpdate();
    return { ok: true };
  }

  private settleWagers(pctById: Map<string, number>): void {
    const remaining: Wager[] = [];
    for (const wager of this.wagers) {
      if (wager.status !== "accepted" || wager.settleRound !== this.roundNumber) {
        remaining.push(wager);
        continue;
      }
      const from = this.guilds.get(wager.fromGuild);
      const to = this.guilds.get(wager.toGuild);
      if (!from || !to) continue;
      const pFrom = pctById.has(from.id) ? pctById.get(from.id)! : null;
      const pTo = pctById.has(to.id) ? pctById.get(to.id)! : null;

      if (pFrom === null && pTo === null) {
        this.postSystemMessage(from.id, `🪙 Our wager with ${to.name} was voided - neither side called a stock.`);
        this.postSystemMessage(to.id, `🪙 Our wager with ${from.name} was voided - neither side called a stock.`);
        continue;
      }

      const fromWins = pTo === null || (pFrom !== null && pFrom > pTo);
      const winner = fromWins ? from : to;
      const loser = fromWins ? to : from;
      const amount = Math.min(wager.amount, loser.tokens);
      loser.tokens -= amount;
      winner.tokens += amount;
      updateGuildTokens(loser.id, loser.tokens);
      updateGuildTokens(winner.id, winner.tokens);
      this.postSystemMessage(winner.id, `🪙 We won the wager against ${loser.name} - ${amount} gold claimed!`);
      this.postSystemMessage(loser.id, `🪙 We lost the wager against ${winner.name} - ${amount} gold paid out.`);
      this.awardAchievement(winner, "first_wager_won");
    }
    this.wagers = remaining;
  }

  async proposeTicker(guildId: string, leaderSecret: string, ticker: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can propose a ticker" };
    if (Date.now() >= this.roundEndsAt) return { ok: false, error: "Round is resolving, try again in a moment" };
    const quote = await priceEngine.getQuote(ticker);
    if (!quote.valid) return { ok: false, error: `Unknown ticker symbol "${ticker.toUpperCase()}"` };
    guild.proposal = { ticker: ticker.trim().toUpperCase(), startPrice: quote.price, submittedAt: Date.now() };
    guild.lastCallRound = this.roundNumber;
    guild.leaderless = false;
    this.emitUpdate();
    return { ok: true };
  }

  // ---------- round loop ----------

  private scheduleNextRound(): void {
    this.roundStartedAt = Date.now();
    this.roundEndsAt = this.roundStartedAt + CONFIG.ROUND_DURATION_MS;
    this.timer = setTimeout(() => {
      this.resolveRound().catch((err) => console.error("[gameEngine] round resolution failed", err));
    }, CONFIG.ROUND_DURATION_MS);
  }

  private livingGuilds(): Guild[] {
    return [...this.guilds.values()].filter((g) => g.alive);
  }

  private placeExpansion(guild: Guild): CellKey | null {
    const candidates = new Set<CellKey>();
    for (const owned of guild.squares) {
      for (const n of neighborsOf(owned)) {
        const cell = this.grid.get(n);
        if (cell && cell.owner === null && !cell.river) candidates.add(n);
      }
    }
    if (candidates.size === 0) return null;
    const pick = [...candidates][Math.floor(Math.random() * candidates.size)];
    const cell = this.grid.get(pick)!;
    guild.squares.add(pick);
    this.claimCell(guild, cell);
    return pick;
  }

  /** Assigns ownership of a newly-claimed cell to `guild`, and applies the
   * one-time Ruins payout (then demotes it back to plain empty land) if
   * that's what was just claimed. Shared by placeExpansion and placeTile -
   * the two ways a neutral cell changes hands outside of battle. */
  private claimCell(guild: Guild, cell: Cell): void {
    cell.owner = guild.id;
    if (cell.resourceKind === "ruins") {
      cell.type = "empty";
      cell.resourceKind = undefined;
      this.castles = this.castles.filter((c) => c !== cellKey(cell.x, cell.y));
      guild.tokens += CONFIG.RUINS_PAYOUT_SILVER;
      updateGuildTokens(guild.id, guild.tokens);
      this.postSystemMessage(guild.id, `💰 Ancient ruins unearthed ${CONFIG.RUINS_PAYOUT_SILVER} silver before crumbling to dust.`);
    }
  }

  /** Earns the guild `count` tiles into its bank (1 normally, more for the
   * round's top caller - see TOP_CALLER_TILE_BONUS). Whatever doesn't fit
   * under MAX_PENDING_TILES is destroyed instead of banked; the leader
   * places banked tiles later via placeTile(), wherever they like next to
   * their territory. */
  private grantTile(guild: Guild, count = 1): "banked" | "destroyed" {
    const capacity = CONFIG.MAX_PENDING_TILES - guild.pendingTiles;
    if (capacity <= 0) return "destroyed";
    const granted = Math.min(count, capacity);
    guild.pendingTiles += granted;
    return granted < count ? "destroyed" : "banked";
  }

  /** Applies a winning guild's sector/kingdom bonus (if their called ticker
   * belongs to a known sector): Tech adds a bonus tile, Finance/Energy add
   * bonus silver directly. Call only for a guild that has just won this
   * round with a real proposal. */
  /** Does `guild` currently own at least one castle of `kind`? */
  private ownsCastleKind(guild: Guild, kind: ResourceKind): boolean {
    return this.castles.some((c) => {
      const cell = this.grid.get(c);
      return cell?.owner === guild.id && cell.resourceKind === kind;
    });
  }

  private applySectorBonus(guild: Guild): { tileBonus: number; silverBonus: number; sectorKey: string | undefined } {
    const sector = guild.proposal ? sectorForTicker(guild.proposal.ticker) : null;
    if (!sector) return { tileBonus: 0, silverBonus: 0, sectorKey: undefined };

    guild.sectorWins[sector.key] = (guild.sectorWins[sector.key] ?? 0) + 1;
    const wins = guild.sectorWins[sector.key];

    let tileBonus = sector.key === "tech" ? SECTOR_TILE_BONUS : 0;
    let silverBonus = SECTOR_SILVER_BONUS[sector.key] ?? 0;
    // Sector structures amplify their own sector's bonus for whoever holds
    // them - a Foundry doubles the Tech tile bonus, a Refinery doubles the
    // Energy silver bonus, giving a concrete reason to fight over them.
    if (sector.key === "tech" && tileBonus > 0 && this.ownsCastleKind(guild, "foundry")) tileBonus *= 2;
    if (sector.key === "energy" && silverBonus > 0 && this.ownsCastleKind(guild, "refinery")) silverBonus *= 2;

    // Specialization: enough proven wins in a kingdom sector earns a
    // permanent add-on to that sector's own bonus, independent of any
    // structure - a standing reward for committing to a sector over time.
    if ((KINGDOM_SECTORS as readonly string[]).includes(sector.key) && wins >= CONFIG.SECTOR_SPECIALIST_THRESHOLD) {
      if (sector.key === "tech") tileBonus += CONFIG.SPECIALIST_TILE_BONUS;
      else silverBonus += CONFIG.SPECIALIST_SILVER_BONUS;
    }

    if (silverBonus > 0) {
      guild.tokens += silverBonus;
      updateGuildTokens(guild.id, guild.tokens);
    }
    if (wins >= 3) this.awardAchievement(guild, "sector_specialist");

    // Diversification: 3 different kingdom sectors across your last 3 wins.
    guild.recentWinSectors.push(sector.key);
    if (guild.recentWinSectors.length > 3) guild.recentWinSectors.shift();
    if (guild.recentWinSectors.length === 3 && new Set(guild.recentWinSectors).size === 3) {
      guild.tokens += CONFIG.DIVERSIFICATION_BONUS;
      updateGuildTokens(guild.id, guild.tokens);
      this.postSystemMessage(guild.id, `🎯 Diversified portfolio — 3 different kingdoms in our last 3 calls, +${CONFIG.DIVERSIFICATION_BONUS} silver!`);
      guild.recentWinSectors = [];
    }

    // Rotating sector contract: first guild to hit the target claims it.
    if (this.activeContract && this.activeContract.sectorKey === sector.key) {
      const contract = this.activeContract;
      contract.progress[guild.id] = (contract.progress[guild.id] ?? 0) + 1;
      if (contract.progress[guild.id] >= contract.target) {
        guild.tokens += contract.reward;
        updateGuildTokens(guild.id, guild.tokens);
        const sectorName = SECTORS[sector.key]?.name ?? sector.key;
        this.postSystemMessage(guild.id, `📜 Contract fulfilled — ${contract.target} ${sectorName} calls won, +${contract.reward} silver!`);
        this.rollNewContract();
      }
    }

    return { tileBonus, silverBonus, sectorKey: sector.key };
  }

  /** Grants a one-time silver-rewarding achievement, if not already unlocked. */
  private awardAchievement(guild: Guild, key: AchievementKey): void {
    if (guild.achievements.has(key)) return;
    guild.achievements.add(key);
    const info = ACHIEVEMENTS[key];
    guild.tokens += info.silverReward;
    updateGuildTokens(guild.id, guild.tokens);
    updateGuildAchievements(guild.id, [...guild.achievements]);
    this.postSystemMessage(guild.id, `${info.icon} Achievement unlocked: ${info.name} — +${info.silverReward} silver!`);
  }

  /** Diminishing-returns multiplier applied to silver/gold rewards so a
   * bigger guild's shared pot grows sub-linearly with its roster - a solo
   * warband keeps every coin (multiplier 1), a 4-member guild gets 2x (not
   * 4x), a 9-member guild gets 3x, and so on. Tiles/territory outcomes are
   * NOT scaled this way - only the silver/gold currency layer is. */
  private guildRewardMultiplier(memberCount: number): number {
    return Math.sqrt(Math.max(1, memberCount));
  }

  /** Leader spends one banked tile to claim a specific empty field
   * adjacent to their existing territory. Can be called any time, not just
   * during a round. */
  placeTile(guildId: string, leaderSecret: string, key: CellKey): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can place a tile" };
    if (guild.pendingTiles <= 0) return { ok: false, error: "No banked tiles to place" };
    const cell = this.grid.get(key);
    if (!cell) return { ok: false, error: "That field doesn't exist" };
    if (cell.owner !== null) return { ok: false, error: "That field is already claimed" };
    if (cell.river) return { ok: false, error: "You can't settle a river" };
    const adjacent = neighborsOf(key).some((n) => this.grid.get(n)?.owner === guild.id);
    if (!adjacent) return { ok: false, error: "Must place next to your existing territory" };
    guild.squares.add(key);
    this.claimCell(guild, cell);
    guild.pendingTiles -= 1;
    this.emitUpdate();
    return { ok: true };
  }

  private doTakeover(winner: Guild, loser: Guild): void {
    for (const key of loser.squares) {
      const cell = this.grid.get(key);
      if (cell) cell.owner = winner.id;
      winner.squares.add(key);
    }
    loser.squares.clear();
    loser.alive = false;
    const merged = new Set([...winner.members, ...loser.members, loser.leaderUsername]);
    winner.members = [...merged];
    updateGuildMembers(winner.id, winner.members);
    winner.takeovers += 1;
    updateGuildTakeovers(winner.id, winner.takeovers);
    this.awardAchievement(winner, "first_conquest");
    delete winner.streaks[loser.id];
    // Drop any other pending battles involving the now-absorbed guild.
    this.battles = this.battles.filter((b) => b.guildA !== loser.id && b.guildB !== loser.id);
  }

  private async resolveRound(): Promise<void> {
    const results: RoundResultEntry[] = [];
    const pctById = new Map<string, number>();
    const priceInfo = new Map<string, { ticker: string; start: number; end: number }>();

    for (const guild of this.livingGuilds()) {
      if (!guild.proposal) continue;
      const quote = await priceEngine.getQuote(guild.proposal.ticker);
      const pct = (quote.price - guild.proposal.startPrice) / guild.proposal.startPrice;
      pctById.set(guild.id, pct);
      priceInfo.set(guild.id, { ticker: guild.proposal.ticker, start: guild.proposal.startPrice, end: quote.price });
    }

    // The single best-performing call of the round (if positive) banks
    // TOP_CALLER_TILE_BONUS tiles instead of the usual 1. Ties (rare with
    // real price data) all get the bonus.
    let topPct = -Infinity;
    for (const pct of pctById.values()) if (pct > topPct) topPct = pct;
    const topGuildIds = topPct > 0 ? new Set([...pctById].filter(([, p]) => p === topPct).map(([id]) => id)) : new Set<string>();
    const tileCountFor = (id: string) => (topGuildIds.has(id) ? CONFIG.TOP_CALLER_TILE_BONUS : 1);

    const battledGuildIds = new Set<string>();
    for (const battle of this.battles) {
      battledGuildIds.add(battle.guildA);
      battledGuildIds.add(battle.guildB);
    }

    const stillPending: Battle[] = [];
    for (const battle of this.battles) {
      const a = this.guilds.get(battle.guildA);
      const b = this.guilds.get(battle.guildB);
      if (!a?.alive || !b?.alive) continue; // stale (one side already absorbed)

      const pa = pctById.has(a.id) ? pctById.get(a.id)! : null;
      const pb = pctById.has(b.id) ? pctById.get(b.id)! : null;
      const infoA = priceInfo.get(a.id) ?? null;
      const infoB = priceInfo.get(b.id) ?? null;

      if (pa === null && pb === null) {
        stillPending.push(battle); // neither side called a stock - contested edge carries over
        continue;
      }

      let winner: Guild, loser: Guild, loserCell: CellKey;
      let outcomeA: RoundResultEntry["outcome"], outcomeB: RoundResultEntry["outcome"];

      if (pa === pb) {
        results.push(this.buildResult(a, infoA, "battle_tied"), this.buildResult(b, infoB, "battle_tied"));
        continue; // tie: no capture, no streak change
      }

      const aWins = pb === null || (pa !== null && pa > pb);
      winner = aWins ? a : b;
      loser = aWins ? b : a;
      loserCell = aWins ? battle.cellB : battle.cellA;
      outcomeA = aWins ? "battle_won" : pa === null ? "battle_forfeit" : "battle_lost";
      outcomeB = aWins ? (pb === null ? "battle_forfeit" : "battle_lost") : "battle_won";

      loser.squares.delete(loserCell);
      winner.squares.add(loserCell);
      const capturedCell = this.grid.get(loserCell);
      if (capturedCell) capturedCell.owner = winner.id;
      const winnerSector = this.applySectorBonus(winner);
      const winnerTileCount = tileCountFor(winner.id) + winnerSector.tileBonus;
      const bonusTileOutcome = this.grantTile(winner, winnerTileCount);

      winner.streaks[loser.id] = (winner.streaks[loser.id] ?? 0) + 1;
      loser.streaks[winner.id] = 0;

      let takeover = false;
      if (winner.streaks[loser.id] >= CONFIG.TAKEOVER_STREAK) {
        takeover = true;
        this.doTakeover(winner, loser);
      }

      const finalOutcomeA = takeover && a.id === winner.id ? "takeover_win" : takeover && a.id === loser.id ? "takeover_lost" : outcomeA;
      const finalOutcomeB = takeover && b.id === winner.id ? "takeover_win" : takeover && b.id === loser.id ? "takeover_lost" : outcomeB;

      results.push(
        this.buildResult(
          a,
          infoA,
          finalOutcomeA,
          a.id === winner.id ? bonusTileOutcome : undefined,
          a.id === winner.id ? winnerTileCount : undefined,
          a.id === winner.id ? winnerSector.sectorKey : undefined,
          a.id === winner.id ? winnerSector.silverBonus : undefined
        ),
        this.buildResult(
          b,
          infoB,
          finalOutcomeB,
          b.id === winner.id ? bonusTileOutcome : undefined,
          b.id === winner.id ? winnerTileCount : undefined,
          b.id === winner.id ? winnerSector.sectorKey : undefined,
          b.id === winner.id ? winnerSector.silverBonus : undefined
        )
      );
    }
    this.battles = stillPending;

    for (const guild of this.livingGuilds()) {
      if (battledGuildIds.has(guild.id)) continue;
      if (!guild.proposal) {
        results.push(this.buildResult(guild, null, "no_proposal"));
        continue;
      }
      const pct = pctById.get(guild.id)!;
      const info = priceInfo.get(guild.id)!;
      if (pct > 0) {
        const sector = this.applySectorBonus(guild);
        const tileCount = tileCountFor(guild.id) + sector.tileBonus;
        const tileOutcome = this.grantTile(guild, tileCount);
        results.push(this.buildResult(guild, info, "expanded", tileOutcome, tileCount, sector.sectorKey, sector.silverBonus));
      } else {
        results.push(this.buildResult(guild, info, "no_change"));
      }
    }

    if (this.roundNumber % CONFIG.CASTLE_BUFF_EVERY_N_ROUNDS === 0) {
      for (const guild of this.livingGuilds()) {
        const ownedCastles = this.castles.filter((c) => this.grid.get(c)?.owner === guild.id);
        for (const c of ownedCastles) {
          const cell = this.grid.get(c);
          const kind = cell?.resourceKind;
          let silverGain = 0;
          if (kind === "exchange") {
            silverGain = CONFIG.EXCHANGE_SILVER_BUFF;
          } else if (kind === "vault") {
            silverGain = Math.max(CONFIG.VAULT_INTEREST_MIN, Math.floor(guild.tokens * CONFIG.VAULT_INTEREST_RATE));
          } else {
            this.placeExpansion(guild);
          }
          if (cell && this.isRiverside(c)) silverGain += CONFIG.RIVERSIDE_SILVER_BONUS;
          if (silverGain > 0) {
            guild.tokens += silverGain;
            updateGuildTokens(guild.id, guild.tokens);
          }
        }
      }
      // Bandit camps raid the nearest living guild's silver until captured.
      for (const c of this.castles) {
        const cell = this.grid.get(c);
        if (cell?.resourceKind !== "bandit_camp" || cell.owner !== null) continue;
        let nearest: Guild | null = null;
        let nearestDist = Infinity;
        for (const guild of this.livingGuilds()) {
          const d = chebyshevDistance(guild.hq, c);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = guild;
          }
        }
        if (nearest && nearest.tokens > 0) {
          const raided = Math.min(CONFIG.BANDIT_RAID_SILVER, nearest.tokens);
          nearest.tokens -= raided;
          updateGuildTokens(nearest.id, nearest.tokens);
          this.postSystemMessage(nearest.id, `🏴 Bandits raided ${raided} silver from our coffers - capture their camp to stop the raids.`);
        }
      }
    }

    this.detectNewBattles();
    this.settleWagers(pctById);
    this.awardRoundLeaderSilver();
    this.checkLeaderInactivity();
    this.trackWinStreaks(results);
    this.updateSectorCouncil();

    for (const guild of this.livingGuilds()) {
      guild.proposal = null;
      guild.scoutedBy = new Set();
    }
    this.lastRoundResults = results;
    if (results.length > 0) {
      this.roundHistory.push({ sessionNumber: this.sessionNumber, roundNumber: this.roundNumber, results });
      if (this.roundHistory.length > CONFIG.ROUND_HISTORY_LIMIT) this.roundHistory.shift();
    }

    this.roundNumber += 1;
    if (this.roundNumber > CONFIG.SESSION_ROUNDS) {
      this.endSession();
    } else {
      this.scheduleNextRound();
    }
    this.emitUpdate();
  }

  private buildResult(
    guild: Guild,
    info: { ticker: string; start: number; end: number } | null,
    outcome: RoundResultEntry["outcome"],
    tileOutcome?: "banked" | "destroyed",
    tilesGranted?: number,
    sectorKey?: string,
    sectorSilverBonus?: number
  ): RoundResultEntry {
    return {
      guildId: guild.id,
      guildName: guild.name,
      ticker: info?.ticker ?? null,
      startPrice: info?.start ?? null,
      endPrice: info?.end ?? null,
      pctChange: info ? (info.end - info.start) / info.start : null,
      outcome,
      tileOutcome,
      tilesGranted,
      sectorKey,
      sectorSilverBonus,
    };
  }

  /** Every round, the guild holding strictly the most territory earns
   * ROUND_LEADER_SILVER (scaled by guildRewardMultiplier). A tie means no
   * clear leader, so nobody is awarded - this also means round 1 never
   * pays out, since every guild starts tied at 4 squares. */
  private awardRoundLeaderSilver(): void {
    const living = this.livingGuilds();
    let leader: Guild | null = null;
    let tied = false;
    for (const g of living) {
      if (!leader || g.squares.size > leader.squares.size) {
        leader = g;
        tied = false;
      } else if (g.squares.size === leader.squares.size) {
        tied = true;
      }
    }
    if (!leader || tied) return;
    const silver = Math.round(CONFIG.ROUND_LEADER_SILVER * this.guildRewardMultiplier(leader.members.length));
    if (silver <= 0) return;
    leader.tokens += silver;
    updateGuildTokens(leader.id, leader.tokens);
    this.postSystemMessage(leader.id, `🪙 Our territory leads the realm this round - +${silver} silver.`);
  }

  /** A guild with more than one member goes leaderless if its leader hasn't
   * made a successful call in LEADER_INACTIVITY_ROUNDS rounds - any existing
   * member can then claim leadership (see claimLeadership). Solo guilds are
   * exempt: with nobody else to promote, there's nothing to fix by flagging
   * it. */
  private checkLeaderInactivity(): void {
    for (const guild of this.livingGuilds()) {
      if (guild.leaderless || guild.members.length <= 1) continue;
      if (this.roundNumber - guild.lastCallRound > CONFIG.LEADER_INACTIVITY_ROUNDS) {
        guild.leaderless = true;
        this.postSystemMessage(guild.id, `⚠️ Our leader has gone quiet - any member can claim leadership from the Overview tab.`);
      }
    }
  }

  /** Tracks each guild's consecutive round-win streak (any winning outcome)
   * for the win_streak_5 achievement; any non-win outcome resets it. */
  private trackWinStreaks(results: RoundResultEntry[]): void {
    const winOutcomes = new Set(["expanded", "battle_won", "takeover_win"]);
    const wonThisRound = new Set(results.filter((r) => winOutcomes.has(r.outcome)).map((r) => r.guildId));
    for (const guild of this.livingGuilds()) {
      if (wonThisRound.has(guild.id)) {
        guild.currentStreak += 1;
        if (guild.currentStreak >= 5) this.awardAchievement(guild, "win_streak_5");
      } else {
        guild.currentStreak = 0;
      }
    }
  }

  /** Recomputes which guild currently leads each kingdom sector's win
   * count - the Sector Council Seat, which scouts more cheaply while held. */
  private updateSectorCouncil(): void {
    for (const key of KINGDOM_SECTORS) {
      let leader: Guild | null = null;
      let best = 0;
      for (const guild of this.livingGuilds()) {
        const wins = guild.sectorWins[key] ?? 0;
        if (wins > best) {
          best = wins;
          leader = guild;
        }
      }
      this.sectorCouncil[key] = leader ? leader.id : null;
    }
  }

  private holdsAnyCouncilSeat(guildId: string): boolean {
    return Object.values(this.sectorCouncil).includes(guildId);
  }

  /** Any current member of a leaderless guild can claim leadership,
   * receiving a fresh leaderSecret. Membership here is just a self-asserted
   * username match, same trust level as the rest of the game - there's no
   * password/account system to verify identity more strongly than that. */
  claimLeadership(guildId: string, username: string): { ok: true; leaderSecret: string } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (!guild.leaderless) return { ok: false, error: "This guild already has an active leader" };
    const clean = username.trim().slice(0, 30);
    if (!clean || !guild.members.includes(clean)) return { ok: false, error: "Only an existing member can claim leadership" };
    const secret = randomToken();
    guild.leaderUsername = clean;
    guild.leaderSecret = secret;
    guild.leaderless = false;
    guild.lastCallRound = this.roundNumber;
    updateGuildLeader(guild.id, clean, secret);
    this.postSystemMessage(guild.id, `👑 ${clean} has claimed leadership of the guild.`);
    this.emitUpdate();
    return { ok: true, leaderSecret: secret };
  }

  setTagline(guildId: string, leaderSecret: string, tagline: string): { ok: true } | { ok: false; error: string } {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can set the tagline" };
    guild.tagline = tagline.trim().slice(0, 80);
    updateGuildTagline(guild.id, guild.tagline);
    this.emitUpdate();
    return { ok: true };
  }

  private detectNewBattles(): void {
    const existingEdges = new Set(this.battles.map((b) => [b.cellA, b.cellB].sort().join("|")));
    for (const [key, cell] of this.grid) {
      if (!cell.owner) continue;
      const { x, y } = parseKey(key);
      const rightKey = cellKey(x + 1, y);
      const downKey = cellKey(x, y + 1);
      for (const otherKey of [inBounds(x + 1, y) ? rightKey : null, inBounds(x, y + 1) ? downKey : null]) {
        if (!otherKey) continue;
        const other = this.grid.get(otherKey);
        if (!other?.owner || other.owner === cell.owner) continue;
        if (this.areAllied(cell.owner, other.owner)) continue;
        const edgeId = [key, otherKey].sort().join("|");
        if (existingEdges.has(edgeId)) continue;
        existingEdges.add(edgeId);
        this.battles.push({
          id: randomUUID(),
          guildA: cell.owner,
          guildB: other.owner,
          cellA: key,
          cellB: otherKey,
          createdRound: this.roundNumber,
        });
        this.trackBattleCell(key);
        this.trackBattleCell(otherKey);
      }
    }
  }

  // Records recent battle activity for the territory heatmap - the newest
  // entries sit at the end of the array, so index (not a timestamp) is what
  // drives how "hot" a cell renders on the client.
  private trackBattleCell(key: CellKey): void {
    const idx = this.recentBattleCells.indexOf(key);
    if (idx !== -1) this.recentBattleCells.splice(idx, 1);
    this.recentBattleCells.push(key);
    if (this.recentBattleCells.length > CONFIG.RECENT_BATTLE_CELLS_LIMIT) this.recentBattleCells.shift();
  }

  private endSession(): void {
    const living = this.livingGuilds();
    let winner: Guild | null = null;
    let tied = false;
    for (const g of living) {
      if (!winner || g.squares.size > winner.squares.size) {
        winner = g;
        tied = false;
      } else if (g.squares.size === winner.squares.size) {
        tied = true;
      }
    }
    if (winner && !tied && winner.squares.size > 0) {
      const silver = Math.round(CONFIG.SESSION_WINNER_SILVER * this.guildRewardMultiplier(winner.members.length));
      winner.tokens += silver;
      updateGuildTokens(winner.id, winner.tokens);
      winner.sessionsWon += 1;
      updateGuildSessionsWon(winner.id, winner.sessionsWon);
      this.lastSessionWinner = { guildId: winner.id, guildName: winner.name };
      recordSessionResult(this.sessionNumber, winner.id, winner.name);
    } else {
      this.lastSessionWinner = null;
      recordSessionResult(this.sessionNumber, null, null);
    }

    this.initGrid();
    for (const guild of this.guilds.values()) {
      guild.streaks = {};
      guild.proposal = null;
      guild.alive = true;
      guild.pendingTiles = 0;
      guild.allies = new Set();
      guild.allianceRequestsSent = new Set();
      guild.scoutedBy = new Set();
      guild.lastCallRound = this.roundNumber;
      guild.leaderless = false;
      this.placeHq(guild);
    }
    this.battles = [];
    this.wagers = [];
    this.recentBattleCells = [];
    this.roundNumber = 1;
    this.sessionNumber += 1;
    this.scheduleNextRound();
  }

  // ---------- snapshot ----------

  // Other guilds' in-progress calls are secret unless it's your own guild or
  // you've paid to scout them this round (see scoutGuild). `hasProposal`
  // always stays accurate - just the ticker/price/sector are hidden.
  private toPublicGuild(g: Guild, forGuildId: string | null): PublicGuild {
    const incomingAllianceRequests = [...this.guilds.values()].filter((other) => other.allianceRequestsSent.has(g.id)).map((other) => other.id);
    // A Watchtower gives free, automatic scouting of any rival you're
    // currently bordering (i.e. locked in a battle with) - reuses the
    // battles array as the existing notion of "bordering."
    const viewer = forGuildId ? this.guilds.get(forGuildId) : null;
    const watchtowerReveal =
      !!viewer &&
      viewer.id !== g.id &&
      this.ownsCastleKind(viewer, "watchtower") &&
      this.battles.some((b) => (b.guildA === viewer.id && b.guildB === g.id) || (b.guildB === viewer.id && b.guildA === g.id));
    const reveal = forGuildId !== null && (forGuildId === g.id || g.scoutedBy.has(forGuildId) || watchtowerReveal);
    const liveQuote = reveal && g.proposal ? priceEngine.peek(g.proposal.ticker) : null;
    return {
      id: g.id,
      name: g.name,
      leaderUsername: g.leaderUsername,
      members: g.members,
      color: g.color,
      flagDecal: g.flagDecal,
      tokens: g.tokens,
      sessionsWon: g.sessionsWon,
      takeovers: g.takeovers,
      pendingTiles: g.pendingTiles,
      createdAt: g.createdAt,
      hq: g.hq,
      squareCount: g.squares.size,
      squares: [...g.squares],
      hasProposal: !!g.proposal,
      alive: g.alive,
      streaks: g.streaks,
      allies: [...g.allies],
      incomingAllianceRequests,
      outgoingAllianceRequests: [...g.allianceRequestsSent],
      proposalTicker: reveal ? (g.proposal?.ticker ?? null) : null,
      proposalStartPrice: reveal ? (g.proposal?.startPrice ?? null) : null,
      livePrice: liveQuote?.price ?? null,
      liveSource: liveQuote?.source ?? null,
      proposalSectorKey: reveal && g.proposal ? (sectorForTicker(g.proposal.ticker)?.key ?? null) : null,
      tagline: g.tagline,
      leaderless: g.leaderless,
      achievements: [...g.achievements],
      sectorWins: g.sectorWins,
    };
  }

  private getHallOfFame(): HallOfFameEntry[] {
    return getTopGuildsByTokens(CONFIG.HALL_OF_FAME_LIMIT).map((row) => ({
      guildId: row.id,
      name: row.name,
      color: row.color,
      flagDecal: row.flag_decal,
      tokens: row.tokens,
      sessionsWon: row.sessions_won,
      takeovers: row.takeovers,
    }));
  }

  getSnapshot(forGuildId: string | null = null): GameStateSnapshot {
    return {
      gridSize: CONFIG.GRID_SIZE,
      cells: [...this.grid.values()],
      guilds: [...this.guilds.values()].map((g) => this.toPublicGuild(g, forGuildId)),
      battles: this.battles,
      roundNumber: this.roundNumber,
      sessionNumber: this.sessionNumber,
      sessionRounds: CONFIG.SESSION_ROUNDS,
      roundStartedAt: this.roundStartedAt,
      roundEndsAt: this.roundEndsAt,
      marketOpen: isMarketOpen(),
      lastRoundResults: this.lastRoundResults,
      roundHistory: this.roundHistory,
      lastSessionWinner: this.lastSessionWinner,
      hallOfFame: this.getHallOfFame(),
      wagers: this.wagers,
      recentBattleCells: this.recentBattleCells,
      sectorCouncil: this.sectorCouncil,
      activeContract: this.activeContract
        ? { sectorKey: this.activeContract.sectorKey, target: this.activeContract.target, reward: this.activeContract.reward }
        : null,
    };
  }

  getGuildById(id: string): Guild | undefined {
    return this.guilds.get(id);
  }

  private emitUpdate(): void {
    this.onUpdate?.();
  }
}
