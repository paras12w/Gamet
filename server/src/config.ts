export const CONFIG = {
  PORT: Number(process.env.PORT ?? 4000),

  GRID_SIZE: Number(process.env.GRID_SIZE ?? 50),

  // A full round: guild leaders propose a ticker, price is tracked, expansion/battles
  // resolve at the end. Default 3 minutes; override for local testing.
  ROUND_DURATION_MS: Number(process.env.ROUND_DURATION_MS ?? 3 * 60 * 1000),

  // 2-hour session = 40 rounds of 3 minutes.
  SESSION_ROUNDS: Number(process.env.SESSION_ROUNDS ?? 40),

  // Neutral castle buff fires every N rounds (spec: every 2 rounds / 6 min).
  CASTLE_BUFF_EVERY_N_ROUNDS: Number(process.env.CASTLE_BUFF_EVERY_N_ROUNDS ?? 2),

  // Holding an "exchange" castle grants silver on the buff tick instead of
  // auto-claiming an adjacent field, same cadence as the other resources.
  EXCHANGE_SILVER_BUFF: Number(process.env.EXCHANGE_SILVER_BUFF ?? 5),

  // Silver cost to reveal a rival guild's locked-in call for the round.
  SCOUT_COST: Number(process.env.SCOUT_COST ?? 5),

  // Rounds a leader can go without a successful call before the guild is
  // marked leaderless and any existing member can claim leadership.
  LEADER_INACTIVITY_ROUNDS: Number(process.env.LEADER_INACTIVITY_ROUNDS ?? 10),

  // Consecutive battle wins against the same guild that trigger a full takeover.
  TAKEOVER_STREAK: Number(process.env.TAKEOVER_STREAK ?? 2),

  // Silver awarded each round to the guild with strictly the most territory
  // (skipped on a tie - no ambiguous leader, no reward). Diminished by guild
  // size - see guildRewardMultiplier in gameEngine.ts.
  ROUND_LEADER_SILVER: Number(process.env.ROUND_LEADER_SILVER ?? 3),

  // Silver awarded to the session-winning guild (1 gold coin's worth - see
  // GOLD_TO_SILVER). Also diminished by guild size.
  SESSION_WINNER_SILVER: Number(process.env.SESSION_WINNER_SILVER ?? 100),

  // A won round or battle earns a tile into the guild's bank instead of
  // auto-placing it; the leader places banked tiles wherever they like next
  // to existing territory, whenever they like. Bank overflows destroy the
  // newly-earned tile instead of growing past this cap.
  MAX_PENDING_TILES: Number(process.env.MAX_PENDING_TILES ?? 5),

  // The single guild whose call gained the most this round (if positive)
  // banks this many tiles instead of the usual 1.
  TOP_CALLER_TILE_BONUS: Number(process.env.TOP_CALLER_TILE_BONUS ?? 3),

  // Minimum Chebyshev distance enforced between randomly-placed HQs (2x2 blocks).
  MIN_HQ_DISTANCE: Number(process.env.MIN_HQ_DISTANCE ?? 12),

  // How often the background price-simulation tick advances (ms).
  PRICE_TICK_MS: Number(process.env.PRICE_TICK_MS ?? 4000),

  // Optional Finnhub API key for a higher-quality live quote source.
  // Falls back to Yahoo Finance's unauthenticated chart endpoint if unset.
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ?? "",

  DB_PATH: process.env.DB_PATH ?? "./data/gamet.sqlite",

  // How many past rounds' results the server keeps for the scrollable
  // battle/round history feed.
  ROUND_HISTORY_LIMIT: Number(process.env.ROUND_HISTORY_LIMIT ?? 20),

  // How many guilds appear in the all-time Hall of Fame, ranked by tokens.
  HALL_OF_FAME_LIMIT: Number(process.env.HALL_OF_FAME_LIMIT ?? 10),

  // How many recently-contested cells the territory heatmap remembers.
  // Position in the list (not a timestamp) drives its recency/intensity.
  RECENT_BATTLE_CELLS_LIMIT: Number(process.env.RECENT_BATTLE_CELLS_LIMIT ?? 80),

  // General API rate limit: requests per window, per IP.
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 10_000),
  RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX ?? 60),

  // Tighter limits on spam-prone actions (guild creation, chat posting).
  CREATE_GUILD_RATE_WINDOW_MS: Number(process.env.CREATE_GUILD_RATE_WINDOW_MS ?? 10 * 60 * 1000),
  CREATE_GUILD_RATE_MAX: Number(process.env.CREATE_GUILD_RATE_MAX ?? 5),
  CHAT_RATE_WINDOW_MS: Number(process.env.CHAT_RATE_WINDOW_MS ?? 10_000),
  CHAT_RATE_MAX: Number(process.env.CHAT_RATE_MAX ?? 10),

  // Number of winding river paths carved across the map.
  RIVER_COUNT: Number(process.env.RIVER_COUNT ?? 2),

  // Vault (Finance structure): silver interest on the buff tick, as a
  // fraction of the guild's current silver, floored at this minimum.
  VAULT_INTEREST_RATE: Number(process.env.VAULT_INTEREST_RATE ?? 0.05),
  VAULT_INTEREST_MIN: Number(process.env.VAULT_INTEREST_MIN ?? 2),

  // Bandit Camp: silver raided from the nearest living guild each buff tick
  // while the camp remains uncaptured.
  BANDIT_RAID_SILVER: Number(process.env.BANDIT_RAID_SILVER ?? 3),

  // Ruins: one-time silver payout when a guild's territory claims them;
  // the tile then reverts to plain empty land.
  RUINS_PAYOUT_SILVER: Number(process.env.RUINS_PAYOUT_SILVER ?? 15),

  // Riverside fertility: bonus silver on the buff tick for a held resource
  // castle that borders a river tile.
  RIVERSIDE_SILVER_BONUS: Number(process.env.RIVERSIDE_SILVER_BONUS ?? 2),

  // Silver cost to buy one river tile outright as a bridge, directly (not
  // from the tile bank) - any river tile bordering your territory is
  // eligible. A river more than one tile wide needs one bridge purchase per
  // lane. Rivers are otherwise fully impassable.
  BRIDGE_TILE_COST: Number(process.env.BRIDGE_TILE_COST ?? 5),

  // Sector specialization: once a guild has this many wins in one of the
  // three kingdom sectors, every future win there gets a permanent bonus
  // on top of the base sector bonus (and any structure doubling).
  SECTOR_SPECIALIST_THRESHOLD: Number(process.env.SECTOR_SPECIALIST_THRESHOLD ?? 5),
  SPECIALIST_TILE_BONUS: Number(process.env.SPECIALIST_TILE_BONUS ?? 1),
  SPECIALIST_SILVER_BONUS: Number(process.env.SPECIALIST_SILVER_BONUS ?? 2),

  // Sector Council Seat: whichever guild currently leads a kingdom sector's
  // win count scouts more cheaply while they hold it.
  COUNCIL_SCOUT_DISCOUNT: Number(process.env.COUNCIL_SCOUT_DISCOUNT ?? 2),

  // Rotating sector contract: first guild to win this many calls in the
  // contract's sector claims the reward, then a new contract rolls.
  CONTRACT_TARGET: Number(process.env.CONTRACT_TARGET ?? 3),
  CONTRACT_REWARD: Number(process.env.CONTRACT_REWARD ?? 12),

  // Diversification bonus: reward for a guild whose last 3 winning calls
  // hit 3 different kingdom sectors.
  DIVERSIFICATION_BONUS: Number(process.env.DIVERSIFICATION_BONUS ?? 5),

  // ---------- Market (silver sinks) ----------

  // Buy a field: base silver cost, rising by BUY_TILE_COST_STEP for every
  // purchase the guild has already made this session (resets each season)
  // - keeps it a real spend instead of a free-tile faucet.
  BUY_TILE_BASE_COST: Number(process.env.BUY_TILE_BASE_COST ?? 12),
  BUY_TILE_COST_STEP: Number(process.env.BUY_TILE_COST_STEP ?? 6),

  // Spyglass: scouts every rival with a locked-in call this round in one
  // purchase, instead of paying SCOUT_COST per guild.
  SPYGLASS_COST: Number(process.env.SPYGLASS_COST ?? 12),

  // Herald's Favor: reroll this guild's flag color and emblem at random.
  HERALD_FAVOR_COST: Number(process.env.HERALD_FAVOR_COST ?? 8),

  // Guild Title: a short custom epithet shown under the guild's name.
  TITLE_COST: Number(process.env.TITLE_COST ?? 15),
  TITLE_MAX_LENGTH: Number(process.env.TITLE_MAX_LENGTH ?? 28),
};

// Reserved chat channel id for the realm-wide chat, open to everyone
// (guild members and spectators alike) - separate from per-guild chat, which
// is keyed by real guild ids in the same `chats` map.
export const GLOBAL_CHAT_ID = "global";

// A guild's wealth is stored as a single silver-denominated integer
// (guild.tokens). Gold is a display convention on top of it, not a
// separate stored value - 100 silver renders as "1 gold".
export const GOLD_TO_SILVER = 100;

export const NEUTRAL_CASTLE_COUNT = 44;
export const NEUTRAL_MIN_SPACING = 4;

// Chat history kept per guild (in-memory only, doesn't survive a restart).
export const CHAT_HISTORY_LIMIT = 100;

// Heraldry options for guild flags. Served to the client via GET /api/flags
// and re-validated here on guild creation so a client can't send an
// arbitrary color/emblem.
export const FLAG_COLORS = [
  "#8c1c24", // crimson
  "#2f5233", // forest green
  "#1f3a5f", // royal blue
  "#c9a227", // gold
  "#5b2a6e", // royal purple
  "#3d3d3d", // iron black
  "#e8dfc4", // ivory
  "#6b3e26", // leather brown
  "#1f5f5b", // teal
  "#a1521c", // burnt orange
];

export const FLAG_DECALS = ["🦁", "🦅", "🐺", "🐉", "⚔️", "🛡️", "👑", "✝️", "⭐", "🔥", "🐴", "🪓"];
