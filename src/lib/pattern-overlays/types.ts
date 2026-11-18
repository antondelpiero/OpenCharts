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
  /** Key prices for the info popup, top to bottom as a trader reads them. */
  levels: PatternLevel[];
  drawings: DrawingLine[];
}
