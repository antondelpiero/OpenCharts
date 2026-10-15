import { useEffect, useRef } from "react";
import type { IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";
import { LineStyle } from "lightweight-charts";
import {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  atr,
  stochastic,
  vwap,
  INDICATOR_REGISTRY,
  type IndicatorInstance,
} from "../../lib/indicators.ts";
import { toIndicatorCandles } from "./utils.ts";
import { CHART_COLORS } from "./constants.ts";

type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram">;

/**
 * Maps every chart series back to the indicator instance that produced it, so a
 * click on a plotted line can be resolved to the instance it belongs to. A
 * single instance may own several series (MACD has three), hence many-to-one.
 */
export type IndicatorSeriesIndex = Map<AnySeries, IndicatorInstance>;

export function useIndicators(
  chartRef: React.RefObject<IChartApi | null>,
  candleSeriesRef: React.RefObject<ISeriesApi<"Candlestick"> | null>,
  chartData: CandlestickData<Time>[],
  activeIndicators: IndicatorInstance[],
  isDark: boolean,
  /** Receives the series→instance index after each render pass. */
  onSeriesIndex?: (index: IndicatorSeriesIndex) => void,
): void {
  const indicatorSeriesRef = useRef<Map<string, AnySeries>>(new Map());
  const colors = isDark ? CHART_COLORS.dark : CHART_COLORS.light;
  const onSeriesIndexRef = useRef(onSeriesIndex);
  onSeriesIndexRef.current = onSeriesIndex;

  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || chartData.length === 0) return;

    const chart = chartRef.current;
    const indCandles = toIndicatorCandles(chartData);

    // Remove old indicator series
    for (const [_key, series] of indicatorSeriesRef.current) {
      try {
        chart.removeSeries(series);
      } catch {
        /* already removed */
      }
    }
    indicatorSeriesRef.current.clear();

    const seriesIndex: IndicatorSeriesIndex = new Map();

    /** Register a series under `<instanceId>` (or a suffixed key for multi-series types). */
    const track = (instance: IndicatorInstance, series: AnySeries, suffix = ""): void => {
      indicatorSeriesRef.current.set(instance.id + suffix, series);
      seriesIndex.set(series, instance);
    };

    for (const instance of activeIndicators) {
      const config = INDICATOR_REGISTRY.find((r) => r.type === instance.type);
      if (!config) continue;

      // Per-instance params, falling back to the registry defaults for any key
      // an older saved instance predates.
      const p = { ...config.defaultParams, ...instance.params };
      const color = instance.color || config.color;

      // Scales for "below" panes are shared per type: stacking two RSIs on one
      // scale is the expected behaviour and keeps the pane count stable.
      switch (instance.type) {
        case "SMA": {
          const data = sma(indCandles, p.period!);
          const s = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "right" });
          s.setData(data.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, s);
          break;
        }
        case "EMA": {
          const data = ema(indCandles, p.period!);
          const s = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "right" });
          s.setData(data.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, s);
          break;
        }
        case "RSI": {
          const data = rsi(indCandles, p.period);
          const s = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "rsi" });
          s.setData(data.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, s);
          const refHigh = chart.addLineSeries({
            color: "#555",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "rsi",
          });
          refHigh.setData(data.map((pt) => ({ time: pt.time as Time, value: 70 })));
          track(instance, refHigh, "-70");
          const refLow = chart.addLineSeries({
            color: "#555",
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "rsi",
          });
          refLow.setData(data.map((pt) => ({ time: pt.time as Time, value: 30 })));
          track(instance, refLow, "-30");
          break;
        }
        case "MACD": {
          const data = macd(indCandles, p.fast, p.slow, p.signal);
          const mLine = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "macd" });
          mLine.setData(data.macd.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, mLine, "-line");
          const sLine = chart.addLineSeries({
            color: "#ff9800",
            lineWidth: 1,
            priceScaleId: "macd",
          });
          sLine.setData(data.signal.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, sLine, "-signal");
          const histo = chart.addHistogramSeries({ priceScaleId: "macd" });
          histo.setData(
            data.histogram.map((pt) => ({
              time: pt.time as Time,
              value: pt.value,
              color: pt.value >= 0 ? colors.up + "99" : colors.down + "99",
            })),
          );
          track(instance, histo, "-hist");
          break;
        }
        case "BOLL": {
          const data = bollingerBands(indCandles, p.period, p.stdDev);
          const upper = chart.addLineSeries({
            color: color + "80",
            lineWidth: 1,
            priceScaleId: "right",
          });
          upper.setData(data.upper.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, upper, "-upper");
          const mid = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "right" });
          mid.setData(data.middle.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, mid, "-mid");
          const lower = chart.addLineSeries({
            color: color + "80",
            lineWidth: 1,
            priceScaleId: "right",
          });
          lower.setData(data.lower.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, lower, "-lower");
          break;
        }
        case "ATR": {
          const data = atr(indCandles, p.period);
          const s = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "atr" });
          s.setData(data.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, s);
          break;
        }
        case "STOCH": {
          const data = stochastic(indCandles, p.kPeriod, p.dPeriod);
          const kLine = chart.addLineSeries({ color, lineWidth: 1, priceScaleId: "stoch" });
          kLine.setData(data.k.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, kLine, "-K");
          const dLine = chart.addLineSeries({
            color: "#ff7043",
            lineWidth: 1,
            priceScaleId: "stoch",
          });
          dLine.setData(data.d.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, dLine, "-D");
          break;
        }
        case "VWAP": {
          const data = vwap(indCandles);
          const s = chart.addLineSeries({
            color,
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            priceScaleId: "right",
          });
          s.setData(data.map((pt) => ({ time: pt.time as Time, value: pt.value })));
          track(instance, s);
          break;
        }
      }
    }

    onSeriesIndexRef.current?.(seriesIndex);
    // chartRef/candleSeriesRef are stable refs; colors derived from isDark dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicators, chartData, isDark]);
}
