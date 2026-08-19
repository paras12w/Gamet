// Kingdoms/sectors: a curated classification of well-known tickers into
// themed groups. Calling a ticker outside this list (still playable via a
// live quote) simply has no sector - no flavor badge, no bonus.
export type SectorKey = "tech" | "finance" | "energy" | "consumer" | "industrial" | "index";

export interface SectorInfo {
  key: SectorKey;
  name: string;
  icon: string;
}

export const SECTORS: Record<SectorKey, SectorInfo> = {
  tech: { key: "tech", name: "Technology", icon: "💻" },
  finance: { key: "finance", name: "Finance", icon: "🏦" },
  energy: { key: "energy", name: "Energy", icon: "🛢️" },
  consumer: { key: "consumer", name: "Consumer", icon: "🛒" },
  industrial: { key: "industrial", name: "Industrial", icon: "⚙️" },
  index: { key: "index", name: "Index", icon: "📊" },
};

const TICKER_SECTOR: Record<string, SectorKey> = {
  AAPL: "tech", MSFT: "tech", GOOGL: "tech", GOOG: "tech", AMZN: "tech", TSLA: "tech",
  NVDA: "tech", META: "tech", NFLX: "tech", AMD: "tech", INTC: "tech", ORCL: "tech",
  CSCO: "tech", IBM: "tech", UBER: "tech", ABNB: "tech", COIN: "tech", PLTR: "tech",
  JPM: "finance", BAC: "finance", V: "finance", MA: "finance", PYPL: "finance",
  XOM: "energy", CVX: "energy",
  WMT: "consumer", DIS: "consumer", KO: "consumer", PEP: "consumer", SBUX: "consumer", MCD: "consumer", NKE: "consumer",
  BA: "industrial", GE: "industrial", F: "industrial", GM: "industrial",
  SPY: "index", QQQ: "index", DIA: "index",
};

export function sectorForTicker(ticker: string): SectorInfo | null {
  const key = TICKER_SECTOR[ticker.trim().toUpperCase()];
  return key ? SECTORS[key] : null;
}

// A winning Tech call banks an extra tile; a winning Finance/Energy call
// earns bonus silver directly. Consumer/Industrial/Index are flavor-only -
// not every sector needs a mechanical edge for the theming to land.
export const SECTOR_TILE_BONUS = 1;
export const SECTOR_SILVER_BONUS: Partial<Record<SectorKey, number>> = { finance: 3, energy: 2 };
