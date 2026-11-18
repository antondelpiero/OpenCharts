import type { Candle } from "../schemas.ts";

/**
 * Binance public market data, fetched straight from the browser.
 *
 * No API key; responses carry `Access-Control-Allow-Origin: *`; rate limits are
 * counted per client IP, so this traffic never touches our own backends.
 * `data-api.binance.vision` is Binance's public market-data mirror; unlike
 * `api.binance.com` it isn't geo-blocked (HTTP 451) in regions such as the US.
 */
const BASE = "https://data-api.binance.vision/api/v3";

/** Binance caps klines at 1000 bars per request. */
const MAX_PER_REQUEST = 1000;

/** Binance interval strings match the terminal's timeframe strings. */
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

// [openTime(ms), open, high, low, close, volume, closeTime(ms), …] — prices are strings.
type RawKline = [number, string, string, string, string, string, number, ...unknown[]];

function toCandle(k: RawKline): Candle {
  return {
    time: Math.floor(k[0] / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  };
}

async function getJson<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`Binance ${path} failed: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function intervalMs(interval: string): number {
  const ms = INTERVAL_MS[interval];
  if (!ms) throw new Error(`Unsupported Binance interval "${interval}"`);
  return ms;
}

/** Sort by time and drop duplicate bars where request windows overlap. */
function mergeBars(chunks: Candle[][]): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const chunk of chunks) for (const c of chunk) byTime.set(c.time, c);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function fetchWindow(
  pair: string,
  interval: string,
  window: { startTime?: number; endTime?: number; limit: number },
): Promise<Candle[]> {
  return getJson<RawKline[]>("/klines", { symbol: pair, interval, ...window }).then((rows) =>
    rows.map(toCandle),
  );
}

/**
 * The most recent `limit` bars, ending with the currently forming bar.
 * Above 1000 bars the windows are requested in parallel, walking back from now.
 */
export async function fetchRecentKlines(pair: string, interval: string, limit: number): Promise<Candle[]> {
  if (limit <= MAX_PER_REQUEST) return fetchWindow(pair, interval, { limit });
  const span = MAX_PER_REQUEST * intervalMs(interval);
  const now = Date.now();
  const windows = Math.ceil(limit / MAX_PER_REQUEST);
  const chunks = await Promise.all(
    Array.from({ length: windows }, (_, i) =>
      fetchWindow(pair, interval, { endTime: now - i * span, limit: MAX_PER_REQUEST }),
    ),
  );
  return mergeBars(chunks).slice(-limit);
}

/** Every bar whose open time falls in [fromMs, toMs], paging forward as needed. */
export async function fetchKlineRange(
  pair: string,
  interval: string,
  fromMs: number,
  toMs: number,
): Promise<Candle[]> {
  const step = intervalMs(interval);
  const chunks: Candle[][] = [];
  let startTime = fromMs;
  while (startTime <= toMs) {
    const bars = await fetchWindow(pair, interval, { startTime, endTime: toMs, limit: MAX_PER_REQUEST });
    chunks.push(bars);
    if (bars.length < MAX_PER_REQUEST) break;
    startTime = bars[bars.length - 1]!.time * 1000 + step;
  }
  return mergeBars(chunks);
}

/** Latest traded price for each pair, in one request. */
export async function fetchPrices(pairs: string[]): Promise<Map<string, number>> {
  const rows = await getJson<{ symbol: string; price: string }[]>("/ticker/price", {
    symbols: JSON.stringify(pairs),
  });
  return new Map(rows.map((r) => [r.symbol, Number(r.price)]));
}
