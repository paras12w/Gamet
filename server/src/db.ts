import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config.js";

const dir = path.dirname(CONFIG.DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const db = new Database(CONFIG.DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    leader_username TEXT NOT NULL,
    leader_secret TEXT NOT NULL,
    color TEXT NOT NULL,
    flag_decal TEXT NOT NULL DEFAULT '🛡️',
    members TEXT NOT NULL DEFAULT '[]',
    tokens INTEGER NOT NULL DEFAULT 0,
    sessions_won INTEGER NOT NULL DEFAULT 0,
    takeovers INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session_history (
    session_number INTEGER PRIMARY KEY,
    winner_guild_id TEXT,
    winner_guild_name TEXT,
    ended_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

// Guards for databases created before these columns existed.
const guildColumns = db.prepare(`PRAGMA table_info(guilds)`).all() as { name: string }[];
const hasColumn = (name: string) => guildColumns.some((c) => c.name === name);
if (!hasColumn("flag_decal")) db.exec(`ALTER TABLE guilds ADD COLUMN flag_decal TEXT NOT NULL DEFAULT '🛡️'`);
if (!hasColumn("sessions_won")) db.exec(`ALTER TABLE guilds ADD COLUMN sessions_won INTEGER NOT NULL DEFAULT 0`);
if (!hasColumn("takeovers")) db.exec(`ALTER TABLE guilds ADD COLUMN takeovers INTEGER NOT NULL DEFAULT 0`);

export interface GuildRow {
  id: string;
  name: string;
  leader_username: string;
  leader_secret: string;
  color: string;
  flag_decal: string;
  members: string;
  tokens: number;
  sessions_won: number;
  takeovers: number;
  created_at: number;
}

export function insertGuildRow(row: GuildRow): void {
  db.prepare(
    `INSERT INTO guilds (id, name, leader_username, leader_secret, color, flag_decal, members, tokens, sessions_won, takeovers, created_at)
     VALUES (@id, @name, @leader_username, @leader_secret, @color, @flag_decal, @members, @tokens, @sessions_won, @takeovers, @created_at)`
  ).run(row);
}

export function updateGuildTokens(id: string, tokens: number): void {
  db.prepare(`UPDATE guilds SET tokens = ? WHERE id = ?`).run(tokens, id);
}

export function updateGuildSessionsWon(id: string, sessionsWon: number): void {
  db.prepare(`UPDATE guilds SET sessions_won = ? WHERE id = ?`).run(sessionsWon, id);
}

export function updateGuildTakeovers(id: string, takeovers: number): void {
  db.prepare(`UPDATE guilds SET takeovers = ? WHERE id = ?`).run(takeovers, id);
}

export function updateGuildMembers(id: string, members: string[]): void {
  db.prepare(`UPDATE guilds SET members = ? WHERE id = ?`).run(JSON.stringify(members), id);
}

export function loadAllGuildRows(): GuildRow[] {
  return db.prepare(`SELECT * FROM guilds`).all() as GuildRow[];
}

export function recordSessionResult(sessionNumber: number, winnerGuildId: string | null, winnerGuildName: string | null): void {
  db.prepare(
    `INSERT OR REPLACE INTO session_history (session_number, winner_guild_id, winner_guild_name, ended_at)
     VALUES (?, ?, ?, ?)`
  ).run(sessionNumber, winnerGuildId, winnerGuildName, Date.now());
}

export function saveKv(key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(value), Date.now());
}

export function loadKv<T>(key: string): T | null {
  const row = db.prepare(`SELECT value FROM kv WHERE key = ?`).get(key) as { value: string } | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}
