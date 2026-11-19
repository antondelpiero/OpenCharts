import type { PairAnalysis, PatternResult } from "../../services/analysis";
import { elliottPattern } from "./elliott";
import { fibonacciDrawing, fibonacciLevels } from "./fibonacci";
import { rangePattern } from "./range";
import type { MapContext, MappedPattern, PatternOverlay } from "./types";

export type { PatternLevel, PatternOverlay } from "./types";

/** Families this app can draw so far; others are ignored. */
const MAPPERS: Record<
  string,
  (pattern: PatternResult, id: string, ctx: MapContext) => MappedPattern | null
> = {
  FIBONACCI: (pattern, id) => {
    const drawing = fibonacciDrawing(pattern, `${id}:fib`);
    return drawing ? { drawings: [drawing], levels: fibonacciLevels(drawing), name: "Fibonacci" } : null;
  },
  ELLIOT_WAVE: elliottPattern,
  RANGE: rangePattern,
};

/**
 * Keep the newest analysis per pattern family. The backend can return two for
 * the same family and timeframe (a new run stored while the previous one is
 * still valid); each timeframe has a fixed validity window, so the latest
 * `expiresAt` is the newest run.
 */
function latestPerFamily(entries: PairAnalysis[]): PairAnalysis[] {
  const latest = new Map<string, PairAnalysis>();
  for (const entry of entries) {
    const current = latest.get(entry.patternFamily);
    if (!current || Date.parse(entry.expiresAt) > Date.parse(current.expiresAt)) {
      latest.set(entry.patternFamily, entry);
    }
  }
  return [...latest.values()];
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** One analysis entry → one overlay per drawable pattern. */
function mapEntry(entry: PairAnalysis, ctx: MapContext, expired: boolean): PatternOverlay[] {
  const mapper = MAPPERS[entry.patternFamily];
  if (!mapper) return [];
  const overlays: PatternOverlay[] = [];
  (entry.analysis ?? []).forEach((pattern, index) => {
    const id = `${entry.patternFamily}:${entry.timeframe}:${entry.expiresAt}:${index}`;
    const mapped = mapper(pattern, id, ctx);
    if (!mapped) return;
    overlays.push({
      id,
      family: entry.patternFamily,
      timeframe: entry.timeframe,
      name: mapped.name,
      patternType: str(pattern.pattern_type),
      direction: mapped.direction !== undefined ? mapped.direction : str(pattern.direction),
      confidence: num(pattern.confidence),
      // Elliott patterns carry `wave_status` (completed / forming) instead.
      patternState: str(pattern.pattern_state) ?? str(pattern.wave_status),
      expiresAt: entry.expiresAt,
      expired,
      levels: mapped.levels,
      note: mapped.note ?? null,
      drawings: mapped.drawings,
    });
  });
  return overlays;
}

/**
 * The overlays of one timeframe's analyses, from the raw analysis response.
 * `lastBarSec` (newest candle's open time) lets families project targets past
 * the last candle; without it those projections are left out. `chartTimeframe`
 * is the timeframe being charted when it differs (a larger timeframe's patterns
 * shown on a smaller chart), so projections are spaced in its bars.
 */
export function toOverlays(
  entries: PairAnalysis[],
  timeframe: string,
  lastBarSec: number | null = null,
  isDark = true,
  chartTimeframe = timeframe,
): PatternOverlay[] {
  const ctx: MapContext = { timeframe: chartTimeframe, lastBarSec, isDark };
  return latestPerFamily(entries.filter((e) => e.timeframe === timeframe)).flatMap((entry) =>
    mapEntry(entry, ctx, false),
  );
}

/**
 * Expired analyses from the history listing, every run kept (it is a history,
 * not "the latest"). Targets are not projected: the chart's last candle has
 * moved on since they were made. Drawn exactly like live patterns.
 */
export function toExpiredOverlays(
  entries: PairAnalysis[],
  isDark = true,
  now = Date.now(),
): PatternOverlay[] {
  return entries
    .filter((e) => Date.parse(e.expiresAt) <= now)
    .flatMap((entry) => mapEntry(entry, { timeframe: entry.timeframe, lastBarSec: null, isDark }, true));
}
