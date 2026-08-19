export const CONFIG = {
  PORT: Number(process.env.PORT ?? 4000),

  GRID_SIZE: Number(process.env.GRID_SIZE ?? 25),

  // A full round: guild leaders propose a ticker, price is tracked, expansion/battles
  // resolve at the end. Default 3 minutes; override for local testing.
  ROUND_DURATION_MS: Number(process.env.ROUND_DURATION_MS ?? 3 * 60 * 1000),

  // 2-hour session = 40 rounds of 3 minutes.
  SESSION_ROUNDS: Number(process.env.SESSION_ROUNDS ?? 40),

  // Neutral castle buff fires every N rounds (spec: every 2 rounds / 6 min).
  CASTLE_BUFF_EVERY_N_ROUNDS: Number(process.env.CASTLE_BUFF_EVERY_N_ROUNDS ?? 2),

  // Consecutive battle wins against the same guild that trigger a full takeover.
  TAKEOVER_STREAK: Number(process.env.TAKEOVER_STREAK ?? 2),

  // Tokens awarded to the session-winning guild.
  SESSION_WINNER_TOKENS: Number(process.env.SESSION_WINNER_TOKENS ?? 3),

  // Minimum Chebyshev distance enforced between randomly-placed HQs (2x2 blocks).
  MIN_HQ_DISTANCE: Number(process.env.MIN_HQ_DISTANCE ?? 7),

  // How often the background price-simulation tick advances (ms).
  PRICE_TICK_MS: Number(process.env.PRICE_TICK_MS ?? 4000),

  // Optional Finnhub API key for a higher-quality live quote source.
  // Falls back to Yahoo Finance's unauthenticated chart endpoint if unset.
  FINNHUB_API_KEY: process.env.FINNHUB_API_KEY ?? "",

  DB_PATH: process.env.DB_PATH ?? "./data/gamet.sqlite",
};

export const NEUTRAL_CASTLE_COUNT = 8;
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
