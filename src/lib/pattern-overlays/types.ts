import type { DrawingLine } from "../../pages/trading/constants";

/** One labelled price shown in the pattern's info popup, e.g. "Stop (1.0)". */
export interface PatternLevel {
  label: string;
  price: number;
}

/** One detected pattern, drawn as one or more read-only drawings. */
export interface PatternOverlay {
  /** Stable across refetches of the same analysis; new for a new analysis. */
  id: string;
  family: string;
  timeframe: string;
  /** Short legend label, e.g. "Fibonacci" or "Elliott · Wave 4". */
  name: string;
  /** e.g. "FIBONACCI_RET_75_0" */
  patternType: string | null;
  /** "bullish" | "bearish" as stored by the analyzer. */
  direction: string | null;
  /** 0..1 */
  confidence: number | null;
  /** e.g. "APPROACHING", "AT_LEVEL" */
  patternState: string | null;
  /** ISO timestamp the analysis is valid until. */
  expiresAt: string;
  /** Past its validity (from the analysis history); drawn dimmed, hidden by default. */
  expired: boolean;
  /** Key prices for the info popup, top to bottom as a trader reads them. */
  levels: PatternLevel[];
  /** The analyzer's plain-language expectation, when it gives one. */
  note: string | null;
  drawings: DrawingLine[];
}

/** What a family mapper produces for one pattern. */
export interface MappedPattern {
  drawings: DrawingLine[];
  levels: PatternLevel[];
  name: string;
  /** Overrides the pattern's own `direction` when the family has to derive it. */
  direction?: string | null;
  note?: string | null;
}

/** Chart context a mapper may need, e.g. to project targets past the last candle. */
export interface MapContext {
  timeframe: string;
  /** Open time (unix seconds) of the newest candle on the chart, if loaded. */
  lastBarSec: number | null;
  /** Chart theme, for colours that must contrast with the background. */
  isDark: boolean;
}
