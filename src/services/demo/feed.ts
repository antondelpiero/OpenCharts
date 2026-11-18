import { toExchangePair } from "../../lib/symbols.ts";
import { fetchPrices } from "../market/binance.ts";
import { publish } from "./bus.ts";
import { mark } from "./engine.ts";
import { DEMO_SYMBOLS } from "./instruments.ts";

/**
 * Market-data feed. Polls Binance's latest price for every symbol in one
 * request and publishes it as a `MarketTick`, which drives the watchlist, the
 * chart's forming candle and the paper engine's mark-to-market (engine.mark).
 *
 * Deliberately not tick-by-tick: one request a minute keeps every consumer on
 * current prices. Completed candles are refreshed separately, at each bar close
 * (see useCandles).
 */

const POLL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

const SYMBOLS = DEMO_SYMBOLS.map((s) => ({
  symbol: s.name,
  pair: toExchangePair(s.name),
  tickSize: s.tickSize,
}));

async function poll(): Promise<void> {
  let prices: Map<string, number>;
  try {
    prices = await fetchPrices(SYMBOLS.map((s) => s.pair));
  } catch (err) {
    // Keep the last known prices; the next poll retries.
    console.warn("[feed] price poll failed", err);
    return;
  }
  for (const s of SYMBOLS) {
    const price = prices.get(s.pair);
    if (price === undefined) continue;
    const half = Math.max(s.tickSize, price * 0.0001) / 2;
    publish("market-data", {
      eventType: "MarketTick",
      symbol: s.symbol,
      bid: price - half,
      ask: price + half,
      occurredAt: Date.now(),
    });
    mark(s.symbol, price);
  }
}

export function startDemoFeed(): void {
  if (timer) return;
  void poll();
  timer = setInterval(() => void poll(), POLL_MS);
}

export function stopDemoFeed(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
