import type { IChartApi, ISeriesApi, MouseEventParams, Time } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { DrawingsPrimitive } from "../../lib/chart-plugins/drawing-tools/drawings-primitive";
import { hitTest } from "../../lib/chart-plugins/drawing-tools/hit-test";
import { makeResolveCtx, resolveEntry } from "../../lib/chart-plugins/drawing-tools/resolve";
import { TF_INTERVAL_MS, type DrawingLine, type Timeframe } from "./constants";

const intervalSecOf = (tf: Timeframe) => (TF_INTERVAL_MS[tf] ?? 60_000) / 1000;

interface OverlayLayerOptions {
  chartRef: React.RefObject<IChartApi | null>;
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>;
  /** Changes whenever ChartPanel creates a chart instance (e.g. on a theme switch). */
  chartEpoch: number;
  drawings: DrawingLine[];
  timeframe: Timeframe;
  /** A click landed on an overlay drawing (viewport coordinates for anchoring a popup). */
  onClick?: (drawingId: string, clientX: number, clientY: number) => void;
  /** False while a drawing tool is armed, so placing a drawing never opens overlay info. */
  clickable: boolean;
}

/**
 * Render read-only overlay drawings (e.g. detected patterns) on the candle
 * series, on a DrawingsPrimitive of their own.
 *
 * The user's drawings live on the DrawingToolsManager's primitive, which adds
 * selection, dragging, deletion and the save callbacks. This primitive has no
 * manager, so overlays cannot be selected, moved or deleted, never reach
 * chart-drawing storage, and stay out of undo/redo, by construction. A click
 * on one is reported through `onClick` (hit-tested with the same geometry the
 * drawing tools use), for showing read-only details.
 */
export function useOverlayLayer({
  chartRef,
  candleSeriesRef,
  chartEpoch,
  drawings,
  timeframe,
  onClick,
  clickable,
}: OverlayLayerOptions): void {
  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  const latest = useRef({ drawings, timeframe, onClick, clickable });
  useEffect(() => {
    latest.current = { drawings, timeframe, onClick, clickable };
  }, [drawings, timeframe, onClick, clickable]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    const primitive = new DrawingsPrimitive();
    series.attachPrimitive(primitive);
    primitive.setIntervalSec(intervalSecOf(latest.current.timeframe));
    primitive.setDrawings(latest.current.drawings);
    primitiveRef.current = primitive;

    const handleClick = (param: MouseEventParams<Time>) => {
      const { drawings: current, timeframe: tf, onClick: report, clickable: canClick } = latest.current;
      if (!canClick || !report || !param.point || !param.sourceEvent || current.length === 0) return;
      const ctx = makeResolveCtx(chart, series, intervalSecOf(tf));
      const hit = hitTest(
        current.map((d) => resolveEntry(d, ctx, "normal")),
        param.point,
      );
      if (hit) report(hit.id, param.sourceEvent.clientX, param.sourceEvent.clientY);
    };
    chart.subscribeClick(handleClick);

    return () => {
      primitiveRef.current = null;
      try {
        chart.unsubscribeClick(handleClick);
        series.detachPrimitive(primitive);
      } catch {
        // The chart (and its series) was already removed by ChartPanel's cleanup.
      }
    };
  }, [chartRef, candleSeriesRef, chartEpoch]);

  useEffect(() => {
    primitiveRef.current?.setDrawings(drawings);
  }, [drawings]);

  useEffect(() => {
    primitiveRef.current?.setIntervalSec(intervalSecOf(timeframe));
  }, [timeframe]);
}
