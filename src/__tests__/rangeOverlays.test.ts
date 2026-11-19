import { describe, expect, it } from "vitest";
import { rangePattern } from "../lib/pattern-overlays/range";
import type { MapContext } from "../lib/pattern-overlays/types";

const sec = (iso: string) => Date.parse(iso) / 1000;
const H4 = 4 * 3600;
const ctx: MapContext = { timeframe: "4h", lastBarSec: sec("2026-11-19T08:00:00Z"), isDark: true };

// Abridged from the local trading-api, BTCUSDT 4h, 2026-11-19.
const range = {
  direction: "neutral",
  confidence: 0.55,
  pattern_type: "MARKET_STRUCTURE_RANGE",
  pattern_state: "AT_MIDPOINT",
  range_levels: {
    support: { price: 62140, touch_count: 2, tolerance_band: { max: 62400, min: 61900 } },
    resistance: { price: 65620, touch_count: 4, tolerance_band: { max: 66100, min: 65300 } },
    midpoint: 63880,
  },
  formation_period: { start_timestamp: "2026-11-15T00:00:00Z", end_timestamp: "2026-11-19T08:00:00Z", duration_candles: 27 },
  post_breakout_target: { method: "measured_move", range_height: 3480, bullish_target: 69100, bearish_target: 58660 },
  breakout_bias: { direction: "bearish", probability_bearish_breakout: 0.55, probability_bullish_breakout: 0.45 },
  false_breakout_risk: { level: "high" },
};

describe("rangePattern", () => {
  const mapped = rangePattern(range, "r", ctx)!;
  const byId = (id: string) => mapped.drawings.find((d) => d.id === id)!;

  it("boxes the formation period between support and resistance", () => {
    expect(byId("r:box")).toMatchObject({
      type: "rectangle",
      time: sec("2026-11-15T00:00:00Z"),
      time2: sec("2026-11-19T08:00:00Z"),
      price: 65620,
      price2: 62140,
    });
  });

  it("draws support, resistance and midpoint from the range start, carried right", () => {
    for (const [id, price] of [["r:sup", 62140], ["r:res", 65620], ["r:mid", 63880]] as const) {
      expect(byId(id)).toMatchObject({ type: "trendline", price, price2: price, time: sec("2026-11-15T00:00:00Z"), extendRight: true });
    }
    expect(byId("r:sup").color).not.toBe(byId("r:res").color);
    expect(byId("r:mid").lineStyle).toBe("dashed");
    expect(byId("r:res:label").text).toBe("Resistance 65,620");
  });

  it("projects the measured-move targets past the last candle", () => {
    const start = ctx.lastBarSec! + 5 * H4;
    expect(byId("r:target:bull")).toMatchObject({ price: 69100, time: start, time2: start + 10 * H4 });
    expect(byId("r:target:bear")).toMatchObject({ price: 58660, time: start });
  });

  it("leaves targets out without a last candle", () => {
    const noBar = rangePattern(range, "r", { ...ctx, lastBarSec: null })!;
    expect(noBar.drawings.some((d) => d.id.startsWith("r:target"))).toBe(false);
  });

  it("names it, lists the levels top-down and notes the breakout bias", () => {
    expect(mapped.name).toBe("Range · Market structure");
    expect(mapped.levels.map((l) => [l.label, l.price])).toEqual([
      ["Breakout target", 69100],
      ["Resistance", 65620],
      ["Midpoint", 63880],
      ["Support", 62140],
      ["Breakdown target", 58660],
    ]);
    expect(mapped.note).toBe("Breakout bias: bearish (55%). False-breakout risk: high.");
    expect(rangePattern({ ...range, pattern_type: "RECTANGLE" }, "r", ctx)!.name).toBe("Range · Rectangle");
  });

  it("skips a pattern without both boundaries, and draws flat lines without a start time", () => {
    expect(rangePattern({ ...range, range_levels: { support: { price: 62140 } } }, "r", ctx)).toBeNull();
    const noPeriod = rangePattern({ ...range, formation_period: {} }, "r", ctx)!;
    expect(noPeriod.drawings.find((d) => d.id === "r:sup")!.type).toBe("horizontal");
    expect(noPeriod.drawings.some((d) => d.id === "r:box")).toBe(false);
  });
});
