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

export interface AnalysisPagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface AnalysisHistoryPage {
  entries: PairAnalysis[];
  pagination: AnalysisPagination;
}

/** Page size for the analysis history (trading-api's default). */
export const HISTORY_PAGE_SIZE = 50;

/**
 * Every completed analysis for the pair, valid and expired, newest first, one
 * page at a time (`GET /api/analyze/{pair}?includeExpired=true&limit&offset`).
 */
export async function getPairAnalysisHistory(
  pair: string,
  offset: number,
  signal?: AbortSignal,
): Promise<AnalysisHistoryPage> {
  const qs = new URLSearchParams({
    includeExpired: "true",
    limit: String(HISTORY_PAGE_SIZE),
    offset: String(offset),
  });
  const res = await fetch(`/api/analyze/${encodeURIComponent(pair)}?${qs}`, { signal });
  if (!res.ok) throw new Error(`GET /api/analyze/${pair} (history) failed: HTTP ${res.status}`);
  const body = (await res.json()) as AnalyzeResponse & { pagination?: AnalysisPagination };
  return {
    entries: Array.isArray(body.data) ? body.data : [],
    pagination: body.pagination ?? { limit: HISTORY_PAGE_SIZE, offset, total: 0, hasMore: false },
  };
}
