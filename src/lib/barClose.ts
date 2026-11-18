import { TF_INTERVAL_MS, type Timeframe } from "../pages/trading/constants";

/** Wait this long past the boundary so the exchange has finalised the bar. */
const SETTLE_MS = 3_000;
/** Retry cadence when the newest bar is already past its close (lagging data). */
const LAGGING_RETRY_MS = 15_000;

/**
 * Milliseconds until the bar opening at `lastBarTimeSec` closes, plus a settle
 * delay. Driven by the data rather than a fixed timer, so it lands on the
 * exchange's own boundaries (1d at 00:00 UTC, 1w on Monday 00:00 UTC).
 */
export function msUntilBarClose(lastBarTimeSec: number, timeframe: string, nowMs = Date.now()): number {
  const interval = TF_INTERVAL_MS[timeframe as Timeframe] ?? 60_000;
  const closeMs = lastBarTimeSec * 1000 + interval;
  const wait = closeMs + SETTLE_MS - nowMs;
  return wait > 0 ? wait : LAGGING_RETRY_MS;
}
