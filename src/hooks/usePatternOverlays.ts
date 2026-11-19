import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { toBinancePair } from "../../examples/binance-adapter/binance-adapter";
import { msUntilBarClose } from "../lib/barClose";
import { toOverlays, type PatternOverlay } from "../lib/pattern-overlays";
import { overlayTimeframe } from "../lib/pattern-overlays/group";
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
 * as read-only chart overlays. Without detections on the charted timeframe,
 * the closest larger timeframe that has some is drawn instead (`timeframe` in
 * the result says which one, null when none).
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

  const shownTimeframe = useMemo(
    () => (query.data ? overlayTimeframe(query.data.map((e) => e.timeframe), timeframe) : null),
    [query.data, timeframe],
  );
  const overlays = useMemo<PatternOverlay[]>(
    () =>
      query.data && shownTimeframe
        ? toOverlays(query.data, shownTimeframe, lastBarSec, isDark, timeframe)
        : [],
    [query.data, shownTimeframe, timeframe, lastBarSec, isDark],
  );

  // Every timeframe's patterns, for the patterns panel. Only the drawn
  // timeframe knows the chart's last candle, so only its projections are drawn.
  const allOverlays = useMemo<PatternOverlay[]>(() => {
    if (!query.data) return [];
    const timeframes = [...new Set(query.data.map((e) => e.timeframe))];
    return timeframes.flatMap((tf) =>
      tf === shownTimeframe ? overlays : toOverlays(query.data, tf, null, isDark),
    );
  }, [query.data, shownTimeframe, overlays, isDark]);

  useEffect(() => {
    if (query.error) console.warn("[pattern-overlays] analysis unavailable:", query.error.message);
  }, [query.error]);

  return { overlays, timeframe: shownTimeframe, allOverlays, isLoading: query.isLoading, error: query.error };
}
