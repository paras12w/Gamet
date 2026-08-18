import { CONFIG } from "./config.js";

// Curated fallback seed prices for well-known tickers, used only when a live
// quote can't be fetched (offline dev, provider outage) so the game stays
// playable without a network path to a market data provider.
const KNOWN_TICKERS: Record<string, number> = {
  AAPL: 230, MSFT: 430, GOOGL: 175, GOOG: 177, AMZN: 195, TSLA: 240,
  NVDA: 130, META: 560, NFLX: 700, AMD: 155, INTC: 22, JPM: 215,
  BAC: 40, WMT: 90, DIS: 110, KO: 68, PEP: 145, XOM: 115, CVX: 155,
  BA: 180, GE: 175, F: 11, GM: 48, PYPL: 75, SBUX: 95, MCD: 300,
  NKE: 78, V: 280, MA: 480, ORCL: 145, CSCO: 55, IBM: 220, UBER: 72,
  ABNB: 130, COIN: 210, PLTR: 40, SPY: 560, QQQ: 480, DIA: 400,
};

interface NyParts {
  weekday: string;
  hour: number;
  minute: number;
}

function nyParts(date: Date): NyParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) map[part.type] = part.value;
  return { weekday: map.weekday, hour: Number(map.hour), minute: Number(map.minute) };
}

export function isMarketOpen(date: Date = new Date()): boolean {
  const { weekday, hour, minute } = nyParts(date);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutesSinceMidnight = hour * 60 + minute;
  // NYSE regular session: 9:30am - 4:00pm ET, weekdays. US market holidays
  // are not accounted for (documented limitation) - those days fall back to
  // simulated pricing automatically once a live fetch fails to move.
  return minutesSinceMidnight >= 9 * 60 + 30 && minutesSinceMidnight < 16 * 60;
}

async function fetchLiveQuote(ticker: string): Promise<number | null> {
  if (CONFIG.FINNHUB_API_KEY) {
    const finnhub = await fetchFinnhubQuote(ticker);
    if (finnhub != null) return finnhub;
  }
  return fetchYahooQuote(ticker);
}

async function fetchYahooQuote(ticker: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (GametStockEmpire)" },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFinnhubQuote(ticker: string): Promise<number | null> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${CONFIG.FINNHUB_API_KEY}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json: any = await res.json();
    const price = json?.c;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

interface TrackedTicker {
  price: number;
  lastLiveSync: number;
  source: "live" | "simulated";
}

export interface Quote {
  price: number;
  valid: boolean;
  source: "live" | "simulated";
}

/**
 * Drives per-ticker prices: real quotes while the market is open, a seeded
 * random walk the rest of the time (nights/weekends/provider outage), so a
 * 3-minute round always has a price to measure against.
 */
export class PriceEngine {
  private tracked = new Map<string, TrackedTicker>();
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("[priceEngine] tick failed", err));
    }, CONFIG.PRICE_TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private randomWalk(price: number): number {
    const pct = (Math.random() - 0.5) * 0.006; // ~+/-0.3% per tick
    return Math.max(0.01, price * (1 + pct));
  }

  private async tick(): Promise<void> {
    const open = isMarketOpen();
    for (const [ticker, entry] of this.tracked) {
      if (open) {
        const live = await fetchLiveQuote(ticker);
        if (live != null) {
          entry.price = live;
          entry.lastLiveSync = Date.now();
          entry.source = "live";
          continue;
        }
      }
      entry.price = this.randomWalk(entry.price);
      entry.source = "simulated";
    }
  }

  /** Resolves the current price for a ticker, seeding it on first use. */
  async getQuote(rawTicker: string): Promise<Quote> {
    const ticker = rawTicker.trim().toUpperCase();
    if (!/^[A-Z.]{1,6}$/.test(ticker)) {
      return { price: 0, valid: false, source: "simulated" };
    }

    let entry = this.tracked.get(ticker);
    if (!entry) {
      const live = await fetchLiveQuote(ticker);
      if (live != null) {
        entry = { price: live, lastLiveSync: Date.now(), source: "live" };
      } else if (ticker in KNOWN_TICKERS) {
        entry = { price: KNOWN_TICKERS[ticker], lastLiveSync: 0, source: "simulated" };
      } else {
        return { price: 0, valid: false, source: "simulated" };
      }
      this.tracked.set(ticker, entry);
    }
    return { price: entry.price, valid: true, source: entry.source };
  }

  peek(ticker: string): Quote | null {
    const entry = this.tracked.get(ticker.trim().toUpperCase());
    if (!entry) return null;
    return { price: entry.price, valid: true, source: entry.source };
  }
}

export const priceEngine = new PriceEngine();
