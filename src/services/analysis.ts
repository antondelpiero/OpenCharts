/**
 * Read client for the trading backend's stored LLM analysis.
 *
 * trading-api `GET /api/analyze/{pair}`, used as it is: it returns every
 * completed, non-expired analysis for the pair, across all pattern families and
 * timeframes. This is the only module that knows the URL, so moving to
 * trading-auth later changes this file alone.
 *
 * Deliberately a plain fetch, not `services/api/request.ts`: that wrapper adds
 * this app's own auth token and refresh logic, which the trading backend does
 * not use.
 */

/** One raw pattern object as the LLM stored it. Fields vary by family. */
export type PatternResult = Record<string, unknown>;

export interface PairAnalysis {
  symbol: string;
  patternFamily: string;
  timeframe: string;
  /** ISO timestamp; the analysis is valid until then. */
  expiresAt: string;
  /** Null when the stored result is empty. */
  analysis: PatternResult[] | null;
}

interface AnalyzeResponse {
  success: boolean;
  /** Absent (not `[]`) when the pair has no valid analysis. */
  data?: PairAnalysis[];
}

export async function getPairAnalyses(pair: string, signal?: AbortSignal): Promise<PairAnalysis[]> {
  const res = await fetch(`/api/analyze/${encodeURIComponent(pair)}`, { signal });
  if (!res.ok) throw new Error(`GET /api/analyze/${pair} failed: HTTP ${res.status}`);
  const body = (await res.json()) as AnalyzeResponse;
  return Array.isArray(body.data) ? body.data : [];
}
