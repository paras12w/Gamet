import { randomBytes, randomUUID } from "node:crypto";
import { CHAT_HISTORY_LIMIT, CONFIG, FLAG_COLORS, FLAG_DECALS, NEUTRAL_CASTLE_COUNT, NEUTRAL_MIN_SPACING } from "./config.js";
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
import { insertGuildRow, loadAllGuildRows, recordSessionResult, updateGuildMembers, updateGuildTokens } from "./db.js";
import type { Battle, Cell, CellKey, ChatMessage, GameStateSnapshot, Guild, PublicGuild, ResourceKind, RoundResultEntry } from "./types.js";

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
        hq: cellKey(0, 0), // overwritten by placeHq below
        squares: new Set(),
        proposal: null,
        streaks: {},
        alive: true,
        createdAt: row.created_at,
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
      hq: cellKey(0, 0), // overwritten by placeHq below
      squares: new Set(),
      proposal: null,
      streaks: {},
      alive: true,
      createdAt: Date.now(),
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
    const guild = this.guilds.get(guildId);
    const cleanText = text.trim().slice(0, 300);
    if (!guild || !cleanText) return null;
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
      this.placeExpansion(winner);

      winner.streaks[loser.id] = (winner.streaks[loser.id] ?? 0) + 1;
      loser.streaks[winner.id] = 0;

      let takeover = false;
      if (winner.streaks[loser.id] >= CONFIG.TAKEOVER_STREAK) {
        takeover = true;
        this.doTakeover(winner, loser);
      }

      results.push(
        this.buildResult(a, infoA, takeover && a.id === winner.id ? "takeover_win" : takeover && a.id === loser.id ? "takeover_lost" : outcomeA),
        this.buildResult(b, infoB, takeover && b.id === winner.id ? "takeover_win" : takeover && b.id === loser.id ? "takeover_lost" : outcomeB)
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
        const placed = this.placeExpansion(guild);
        results.push(this.buildResult(guild, info, placed ? "expanded" : "no_change"));
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

    this.roundNumber += 1;
    if (this.roundNumber > CONFIG.SESSION_ROUNDS) {
      this.endSession();
    } else {
      this.scheduleNextRound();
    }
    this.emitUpdate();
  }

  private buildResult(guild: Guild, info: { ticker: string; start: number; end: number } | null, outcome: RoundResultEntry["outcome"]): RoundResultEntry {
    return {
      guildId: guild.id,
      guildName: guild.name,
      ticker: info?.ticker ?? null,
      startPrice: info?.start ?? null,
      endPrice: info?.end ?? null,
      pctChange: info ? (info.end - info.start) / info.start : null,
      outcome,
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
      this.placeHq(guild);
    }
    this.battles = [];
    this.roundNumber = 1;
    this.sessionNumber += 1;
    this.scheduleNextRound();
  }

  // ---------- snapshot ----------

  private toPublicGuild(g: Guild): PublicGuild {
    return {
      id: g.id,
      name: g.name,
      leaderUsername: g.leaderUsername,
      members: g.members,
      color: g.color,
      flagDecal: g.flagDecal,
      tokens: g.tokens,
      hq: g.hq,
      squareCount: g.squares.size,
      squares: [...g.squares],
      hasProposal: !!g.proposal,
      alive: g.alive,
      streaks: g.streaks,
    };
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
      lastSessionWinner: this.lastSessionWinner,
    };
  }

  getGuildById(id: string): Guild | undefined {
    return this.guilds.get(id);
  }

  private emitUpdate(): void {
    this.onUpdate?.();
  }
}
