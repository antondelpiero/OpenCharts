import { createContext, useContext } from "react";
import type { IndicatorInstance, IndicatorType } from "../lib/indicators.ts";
import type { PatternOverlay } from "../lib/pattern-overlays/index.ts";
import type { CreateJournalEntryInput, UpdateJournalEntryInput } from "../services/api/journal.ts";
import type {
  useCandles,
  useJournalEntries,
} from "../services/queries.ts";
import type { Order, PlaceOrderInput, Position, Symbol } from "../services/schemas.ts";
import type { useTradingStore } from "../services/store.tsx";
import type { useChartPreferences } from "../hooks/useChartPreferences.ts";
import type { DrawingLine, DrawingTool, Timeframe } from "../pages/trading/constants.ts";
import type { useReplayChartData } from "../pages/trading/useReplayChartData.ts";

/**
 * The value `<TerminalProvider>` publishes and every panel consumes.
 *
 * Kept apart from the provider so the provider file exports only a component,
 * which is what React Fast Refresh needs to hot-reload it.
 */

export type ConfirmOrderState =
  | (PlaceOrderInput & {
      _submit: () => Promise<unknown>;
      stopPrice?: number;
      /** Adapter-supplied summary rows shown in the confirmation dialog. */
      details?: ReadonlyArray<{ label: string; value: string; hint?: string; tone?: "warning" }>;
      /** A short caution shown in the confirmation dialog. */
      notice?: string;
    })
  | null;

export interface TerminalContextValue {
  // Instrument
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  symbols: Symbol[];
  symbolInfo: Symbol | undefined;
  pipDigits: number;
  tick: { bid: number; ask: number; timestamp: number } | undefined;
  /** Every symbol's latest quote, for list views. */
  ticks: Record<string, { bid: number; ask: number; timestamp: number }>;
  isDark: boolean;

  // Timeframe
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;

  // Chart data
  candles: ReturnType<typeof useCandles>["data"];
  liveCandle: ReturnType<typeof useTradingStore.getState>["liveCandleUpdates"][string] | undefined;
  replayCandles: ReturnType<typeof useReplayChartData>["replayCandles"];
  replayTradeEvents: ReturnType<typeof useReplayChartData>["replayTradeEvents"];
  isReplaying: boolean;

  // Chart configuration
  chartPrefs: ReturnType<typeof useChartPreferences>;
  activeIndicators: IndicatorInstance[];
  addIndicator: (type: IndicatorType) => void;
  updateIndicator: (id: string, params: Record<string, number>) => void;
  removeIndicator: (id: string) => void;
  /** Replace the whole list (loading a chart template). */
  setIndicators: (indicators: IndicatorInstance[]) => void;
  clearIndicators: () => void;
  activePlugins: string[];
  togglePlugin: (id: string) => void;
  setPlugins: (ids: string[]) => void;
  cycleMagnetMode: () => void;

  // Drawings
  drawingTool: DrawingTool;
  setDrawingTool: (tool: DrawingTool) => void;
  drawings: DrawingLine[];
  /** Detected patterns (read-only analysis) for the charted symbol and timeframe. */
  patterns: PatternOverlay[];
  /** What the chart shows: `patterns` plus expired ones of this timeframe switched on. */
  chartPatterns: PatternOverlay[];
  /** Expired analyses loaded so far (all timeframes), hidden on the chart by default. */
  expiredPatterns: PatternOverlay[];
  /** The panel's "Expired" section is open; history is fetched only then. */
  expiredPatternsOpen: boolean;
  setExpiredPatternsOpen: (open: boolean) => void;
  expiredPatternsLoading: boolean;
  expiredPatternsUnavailable: boolean;
  expiredPatternsHasMore: boolean;
  expiredPatternsLoadingMore: boolean;
  loadMoreExpiredPatterns: () => void;
  /** Detected patterns across every timeframe of the symbol (patterns panel). */
  allPatterns: PatternOverlay[];
  /** Timeframe the patterns panel lists first (charted one, or last charted one with patterns). */
  leadingPatternTimeframe: string | null;
  /** Timeframe whose patterns are drawn: the charted one, or the larger one standing in for it. */
  patternTimeframe: string | null;
  patternsLoading: boolean;
  /** The analysis backend could not be reached. */
  patternsUnavailable: boolean;
  /** Drawings of the patterns that are not hidden. */
  patternOverlays: DrawingLine[];
  hiddenPatternIds: ReadonlySet<string>;
  togglePattern: (id: string) => void;
  addDrawing: (drawing: DrawingLine) => void;
  updateDrawing: (drawing: DrawingLine) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  undoDrawing: () => void;
  redoDrawing: () => void;

  // Account and trading
  activeAccountId: string | null;
  account: ReturnType<typeof useTradingStore.getState>["accounts"][number] | undefined;
  positions: Position[];
  orders: Order[];
  positionPnl: number;
  chartPositions: Position[];
  chartOrders: Order[];
  isFeedConnected: boolean;

  // Order entry
  oneClick: boolean;
  toggleOneClick: () => void;
  soundMuted: boolean;
  toggleSoundMute: () => void;
  onOrderSuccess: () => void;
  requestOrderConfirmation: (order: NonNullable<ConfirmOrderState>) => void;
  submitOrderDirect: (input: PlaceOrderInput) => Promise<Order>;
  quickOrder: (side: "BUY" | "SELL", type: "LIMIT" | "STOP", price: number) => void;
  modifyPositionLevels: (
    positionId: string,
    mods: { takeProfit?: number | null; stopLoss?: number | null },
  ) => Promise<void>;
  editPosition: (position: Position | null) => void;
  editOrder: (order: Order | null) => void;
  closePosition: (positionId: string, quantity?: number) => void;
  closeAllPositions: () => void;
  cancelOrder: (orderId: string) => void;

  // Journal
  journalEntries: ReturnType<typeof useJournalEntries>["data"] extends infer T
    ? T extends { entries: infer E }
      ? E
      : never
    : never;
  journalLoading: boolean;
  createJournal: (data: CreateJournalEntryInput) => void;
  updateJournal: (id: string, data: UpdateJournalEntryInput) => void;
  deleteJournal: (id: string) => void;
}

export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function useTerminal(): TerminalContextValue {
  const value = useContext(TerminalContext);
  if (!value) {
    throw new Error(
      "[opencharts] Terminal panels must be rendered inside <TerminalProvider>. " +
        "Use <Terminal /> for the standard layout, or wrap your own composition.",
    );
  }
  return value;
}
