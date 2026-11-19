import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { toBinancePair } from "../../examples/binance-adapter/binance-adapter";
import { toExpiredOverlays, type PatternOverlay } from "../lib/pattern-overlays";
import { getPairAnalysisHistory } from "../services/analysis";

/**
 * Expired analyses for the symbol, from the paginated analysis history.
 *
 * Fetched only while `enabled` (the patterns panel's "Expired" section is
 * open), one page at a time via `loadMore`. Each page also contains the still
 * valid analyses (the history is newest first); those are left to the live
 * overlays and filtered out here.
 */
export function usePatternHistory(symbol: string, isDark: boolean, enabled: boolean) {
  const pair = toBinancePair(symbol);
  const query = useInfiniteQuery({
    queryKey: ["pattern-history", pair],
    queryFn: ({ pageParam, signal }) => getPairAnalysisHistory(pair!, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? last.pagination.offset + last.pagination.limit : undefined,
    enabled: enabled && pair !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const expired = useMemo<PatternOverlay[]>(
    () => toExpiredOverlays(query.data?.pages.flatMap((p) => p.entries) ?? [], isDark),
    [query.data, isDark],
  );

  return {
    expired,
    isLoading: query.isLoading,
    error: query.error,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}
