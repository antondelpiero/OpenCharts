import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toBinancePair } from "../../examples/binance-adapter/binance-adapter";
import { msUntilBarClose } from "../lib/barClose";
import { toOverlays, type PatternOverlay } from "../lib/pattern-overlays";
import { TF_INTERVAL_MS, type Timeframe } from "../pages/trading/constants";
import { getPairAnalyses } from "../services/analysis";

/** Bar-close timing without candles to hand: the current bar opened at the last interval boundary. */
function msUntilNextBarClose(timeframe: string): number {
  const intervalSec = (TF_INTERVAL_MS[timeframe as Timeframe] ?? 60_000) / 1000;
  const nowSec = Math.floor(Date.now() / 1000);
  return msUntilBarClose(nowSec - (nowSec % intervalSec), timeframe);
}

/**
 * The trading backend's detected patterns for the charted symbol and timeframe,
 * as read-only chart overlays.
 *
 * One request covers every timeframe of the pair; switching timeframe only
 * re-filters. Refetches after each bar close so a newly run analysis appears
 * without a reload. When the backend is unreachable the chart simply shows no
 * overlays: it must keep working without it.
 */
export function usePatternOverlays(
  symbol: string,
  timeframe: string,
  lastBarSec: number | null,
  isDark: boolean,
) {
  const pair = toBinancePair(symbol);
  const query = useQuery({
    queryKey: ["pattern-overlays", pair],
    queryFn: ({ signal }) => getPairAnalyses(pair!, signal),
    enabled: pair !== null,
    staleTime: 60_000,
    retry: 1,
    refetchInterval: () => msUntilNextBarClose(timeframe),
  });

  const overlays = useMemo<PatternOverlay[]>(
    () => (query.data ? toOverlays(query.data, timeframe, lastBarSec, isDark) : []),
    [query.data, timeframe, lastBarSec, isDark],
  );

  useEffect(() => {
    if (query.error) console.warn("[pattern-overlays] analysis unavailable:", query.error.message);
  }, [query.error]);

  return { overlays, isLoading: query.isLoading, error: query.error };
}
