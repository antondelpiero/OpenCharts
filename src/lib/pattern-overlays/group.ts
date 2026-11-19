import { TIMEFRAMES } from "../../pages/trading/constants";
import type { PatternOverlay } from "./types";

export interface TimeframeGroup {
  timeframe: string;
  patterns: PatternOverlay[];
}

/** Largest timeframe first, as a trader reads top-down; unknown ones last. */
const RANK = new Map<string, number>([...TIMEFRAMES].reverse().map((tf, i) => [tf, i]));
const rank = (tf: string) => RANK.get(tf) ?? Number.MAX_SAFE_INTEGER;

/**
 * The timeframe whose patterns to draw on a `charted` chart: the charted one
 * when it has any, else the closest larger one that does (15m -> 1h -> 4h ->
 * 1d -> 1w), else null. Never a smaller one.
 */
export function overlayTimeframe(available: Iterable<string>, charted: string): string | null {
  const have = new Set(available);
  if (have.has(charted)) return charted;
  const start = TIMEFRAMES.indexOf(charted as (typeof TIMEFRAMES)[number]);
  if (start < 0) return null;
  return TIMEFRAMES.slice(start + 1).find((tf) => have.has(tf)) ?? null;
}

/**
 * Group patterns by timeframe, largest first, with `leading` (the timeframe
 * the user is looking at) moved to the top when it has patterns.
 */
export function groupByTimeframe(patterns: PatternOverlay[], leading: string | null): TimeframeGroup[] {
  const byTf = new Map<string, PatternOverlay[]>();
  for (const p of patterns) byTf.set(p.timeframe, [...(byTf.get(p.timeframe) ?? []), p]);
  return [...byTf.entries()]
    .map(([timeframe, items]) => ({ timeframe, patterns: items }))
    .sort((a, b) => {
      if (a.timeframe === leading) return -1;
      if (b.timeframe === leading) return 1;
      return rank(a.timeframe) - rank(b.timeframe) || a.timeframe.localeCompare(b.timeframe);
    });
}
