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
