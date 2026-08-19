import { randomBytes, randomUUID } from "node:crypto";
import { CHAT_HISTORY_LIMIT, CONFIG, FLAG_COLORS, FLAG_DECALS, GLOBAL_CHAT_ID, NEUTRAL_CASTLE_COUNT, NEUTRAL_MIN_SPACING } from "./config.js";
import {
  blockCells,
  blockInBounds,
  cellKey,
  chebyshevDistance,
  inBounds,
  isNearCenter,
  neighborsOf,
  parseKey,
  scatterNeutralPositions,
} from "./grid.js";
import { isMarketOpen, priceEngine } from "./priceEngine.js";
import {
  getTopGuildsByTokens,
  insertGuildRow,
  loadAllGuildRows,
  recordSessionResult,
  updateGuildMembers,
  updateGuildSessionsWon,
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
} from "./types.js";

const RESOURCE_KINDS: ResourceKind[] = ["keep", "lumber", "mine"];

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
  return RESOURCE_KINDS[Math.floor(Math.random() * RESOURCE_KINDS.length)];
}

export class GameEngine {
  private grid = new Map<CellKey, Cell>();
  private guilds = new Map<string, Guild>();
  private battles: Battle[] = [];
  private castles: CellKey[] = [];
  roundNumber = 1;
  sessionNumber = 1;
  roundStartedAt = Date.now();
  roundEndsAt = Date.now() + CONFIG.ROUND_DURATION_MS;
  lastRoundResults: RoundResultEntry[] = [];
  roundHistory: RoundHistoryEntry[] = [];
  lastSessionWinner: { guildId: string; guildName: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chats = new Map<string, ChatMessage[]>();
  onUpdate: (() => void) | null = null;
  onChatMessage: ((message: ChatMessage) => void) | null = null;

  constructor() {
    this.initGrid();
    this.restoreGuildsFromDb();
    this.scheduleNextRound();
  }

  // ---------- setup ----------

  private initGrid(): void {
    this.grid.clear();
    this.castles = scatterNeutralPositions(NEUTRAL_CASTLE_COUNT, NEUTRAL_MIN_SPACING);
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
        });
      }
    }
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
        return !!cell && cell.type !== "castle" && cell.owner === null;
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

  postChatMessage(guildId: string, username: string, text: string): ChatMessage | null {
    const isGlobal = guildId === GLOBAL_CHAT_ID;
    const guild = isGlobal ? null : this.guilds.get(guildId);
    const cleanText = text.trim().slice(0, 300);
    if ((!isGlobal && !guild) || !cleanText) return null;
    const message: ChatMessage = {
      id: randomUUID(),
      guildId,
      username: username.trim().slice(0, 30) || "Unknown",
      text: cleanText,
      at: Date.now(),
    };
    const history = this.chats.get(guildId) ?? [];
    history.push(message);
    if (history.length > CHAT_HISTORY_LIMIT) history.shift();
    this.chats.set(guildId, history);
    this.onChatMessage?.(message);
    return message;
  }

  private postSystemMessage(guildId: string, text: string): void {
    this.postChatMessage(guildId, "📯 Herald", text);
  }

  // ---------- guild alliances ----------

  private areAllied(a: string, b: string): boolean {
    return !!this.guilds.get(a)?.allies.has(b);
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

  async proposeTicker(guildId: string, leaderSecret: string, ticker: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const guild = this.guilds.get(guildId);
    if (!guild || !guild.alive) return { ok: false, error: "Guild not found" };
    if (guild.leaderSecret !== leaderSecret) return { ok: false, error: "Only the guild leader can propose a ticker" };
    if (Date.now() >= this.roundEndsAt) return { ok: false, error: "Round is resolving, try again in a moment" };
    const quote = await priceEngine.getQuote(ticker);
    if (!quote.valid) return { ok: false, error: `Unknown ticker symbol "${ticker.toUpperCase()}"` };
    guild.proposal = { ticker: ticker.trim().toUpperCase(), startPrice: quote.price, submittedAt: Date.now() };
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
        if (cell && cell.owner === null) candidates.add(n);
      }
    }
    if (candidates.size === 0) return null;
    const pick = [...candidates][Math.floor(Math.random() * candidates.size)];
    const cell = this.grid.get(pick)!;
    cell.owner = guild.id;
    guild.squares.add(pick);
    return pick;
  }

  /** Earns the guild a tile into its bank, or destroys it if the bank
   * (MAX_PENDING_TILES) is already full. The leader places banked tiles
   * later via placeTile(), wherever they like next to their territory. */
  private grantTile(guild: Guild): "banked" | "destroyed" {
    if (guild.pendingTiles >= CONFIG.MAX_PENDING_TILES) return "destroyed";
    guild.pendingTiles += 1;
    return "banked";
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
    const adjacent = neighborsOf(key).some((n) => this.grid.get(n)?.owner === guild.id);
    if (!adjacent) return { ok: false, error: "Must place next to your existing territory" };
    cell.owner = guild.id;
    guild.squares.add(key);
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
      const bonusTileOutcome = this.grantTile(winner);

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
        this.buildResult(a, infoA, finalOutcomeA, a.id === winner.id ? bonusTileOutcome : undefined),
        this.buildResult(b, infoB, finalOutcomeB, b.id === winner.id ? bonusTileOutcome : undefined)
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
        const tileOutcome = this.grantTile(guild);
        results.push(this.buildResult(guild, info, "expanded", tileOutcome));
      } else {
        results.push(this.buildResult(guild, info, "no_change"));
      }
    }

    if (this.roundNumber % CONFIG.CASTLE_BUFF_EVERY_N_ROUNDS === 0) {
      for (const guild of this.livingGuilds()) {
        const ownedCastles = this.castles.filter((c) => this.grid.get(c)?.owner === guild.id).length;
        for (let i = 0; i < ownedCastles; i++) this.placeExpansion(guild);
      }
    }

    this.detectNewBattles();

    for (const guild of this.livingGuilds()) guild.proposal = null;
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
    tileOutcome?: "banked" | "destroyed"
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
    };
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
      }
    }
  }

  private endSession(): void {
    const living = this.livingGuilds();
    let winner: Guild | null = null;
    for (const g of living) {
      if (!winner || g.squares.size > winner.squares.size) winner = g;
    }
    if (winner && winner.squares.size > 0) {
      winner.tokens += CONFIG.SESSION_WINNER_TOKENS;
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
      this.placeHq(guild);
    }
    this.battles = [];
    this.roundNumber = 1;
    this.sessionNumber += 1;
    this.scheduleNextRound();
  }

  // ---------- snapshot ----------

  private toPublicGuild(g: Guild): PublicGuild {
    const incomingAllianceRequests = [...this.guilds.values()].filter((other) => other.allianceRequestsSent.has(g.id)).map((other) => other.id);
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

  getSnapshot(): GameStateSnapshot {
    return {
      gridSize: CONFIG.GRID_SIZE,
      cells: [...this.grid.values()],
      guilds: [...this.guilds.values()].map((g) => this.toPublicGuild(g)),
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
    };
  }

  getGuildById(id: string): Guild | undefined {
    return this.guilds.get(id);
  }

  private emitUpdate(): void {
    this.onUpdate?.();
  }
}
