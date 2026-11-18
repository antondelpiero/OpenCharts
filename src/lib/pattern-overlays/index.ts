import type { DrawingLine } from "../../pages/trading/constants";
import type { PairAnalysis, PatternResult } from "../../services/analysis";
import { fibonacciDrawing, fibonacciLevels } from "./fibonacci";
import type { PatternLevel, PatternOverlay } from "./types";

export type { PatternLevel, PatternOverlay } from "./types";

type Mapped = { drawings: DrawingLine[]; levels: PatternLevel[] };

/** Families this app can draw so far; others are ignored. */
const MAPPERS: Record<string, (pattern: PatternResult, id: string) => Mapped | null> = {
  FIBONACCI: (pattern, id) => {
    const drawing = fibonacciDrawing(pattern, `${id}:fib`);
    return drawing ? { drawings: [drawing], levels: fibonacciLevels(drawing) } : null;
  },
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

/** The chart's overlays for one timeframe, from the raw analysis response. */
export function toOverlays(entries: PairAnalysis[], timeframe: string): PatternOverlay[] {
  const overlays: PatternOverlay[] = [];
  for (const entry of latestPerFamily(entries.filter((e) => e.timeframe === timeframe))) {
    const mapper = MAPPERS[entry.patternFamily];
    if (!mapper) continue;
    (entry.analysis ?? []).forEach((pattern, index) => {
      const id = `${entry.patternFamily}:${entry.timeframe}:${entry.expiresAt}:${index}`;
      const mapped = mapper(pattern, id);
      if (!mapped) return;
      overlays.push({
        id,
        family: entry.patternFamily,
        timeframe: entry.timeframe,
        patternType: str(pattern.pattern_type),
        direction: str(pattern.direction),
        confidence: num(pattern.confidence),
        patternState: str(pattern.pattern_state),
        expiresAt: entry.expiresAt,
        levels: mapped.levels,
        drawings: mapped.drawings,
      });
    });
  }
  return overlays;
}
