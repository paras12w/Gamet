// Always-on AI-controlled solo guilds. They play through the exact same
// public GameEngine methods a real client would call (propose, scout,
// place tiles, propose/respond to alliances and wagers) - the only thing
// they never do is chat, so they read as real (if quiet) rivals rather
// than a visibly scripted feature.
export const BOT_COUNT = 8;

export const BOT_GUILD_NAMES = [
  "Ironvale Trading Co.",
  "Silverbrook Merchants",
  "Ashford Exchange",
  "Thornwood Guild",
  "Marrow Coast Traders",
  "Duskfall Consortium",
  "Highgate Ventures",
  "Wraithmoor Holdings",
];

export const BOT_USERNAMES = ["Aldric", "Brynhild", "Cassian", "Delphine", "Eamon", "Fiora", "Garrick", "Helka"];

export const BOT_TICKER_POOL = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX", "AMD", "ORCL",
  "JPM", "BAC", "V", "MA", "PYPL",
  "XOM", "CVX",
  "WMT", "DIS", "KO", "PEP", "SBUX", "MCD",
  "BA", "GE", "F",
  "SPY", "QQQ",
];

export const BOT_SCOUT_CHANCE = 0.18;
export const BOT_ALLIANCE_PROPOSE_CHANCE = 0.03;
export const BOT_ALLIANCE_ACCEPT_CHANCE = 0.6;
export const BOT_WAGER_PROPOSE_CHANCE = 0.04;
export const BOT_WAGER_ACCEPT_CHANCE = 0.5;
export const BOT_WAGER_STAKE_FRACTION = 0.3;
