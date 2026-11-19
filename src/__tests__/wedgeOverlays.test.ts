import { describe, expect, it } from "vitest";
import { wedgePattern } from "../lib/pattern-overlays/wedge";
import type { MapContext } from "../lib/pattern-overlays/types";

const sec = (iso: string) => Date.parse(iso) / 1000;
const DAY = 86_400;
const ctx: MapContext = { timeframe: "1d", lastBarSec: sec("2026-11-19T00:00:00Z"), isDark: true };

// Abridged from the local trading-api, BTCUSDT 1d.
const falling = {
  direction: "bullish",
  confidence: 0.6,
  pattern_type: "WEDGE_FALLING",
  trendlines: {
    support: {
      anchor_1: { price: 76151.9, timestamp: "2026-09-02T00:00:00.000Z" },
      anchor_2: { price: 74909.4, timestamp: "2026-09-15T00:00:00.000Z" },
    },
    resistance: {
      anchor_1: { price: 82282.8, timestamp: "2026-09-03T00:00:00.000Z" },
      anchor_2: { price: 79570.9, timestamp: "2026-09-14T00:00:00.000Z" },
    },
  },
  formation_period: { start_timestamp: "2026-09-02T00:00:00.000Z", end_timestamp: "2026-09-17T00:00:00.000Z" },
  convergence_point: { estimated_price: 72114.15, estimated_timestamp: "2026-10-14T00:00:00.000Z" },
  breakout_projection: { stop_loss: 74718.25, target_price: 85208.73, breakout_level: 78831.29, expected_direction: "upward" },
  volume_analysis: { volume_decline_percent: -8.95 },
};

describe("wedgePattern", () => {
  const mapped = wedgePattern(falling, "w", ctx)!;
  const byId = (id: string) => mapped.drawings.find((d) => d.id === id)!;

  it("draws both lines through their anchors across the formation period", () => {
    const res = byId("w:res");
    expect(res).toMatchObject({ type: "trendline", time: sec("2026-09-02T00:00:00Z"), time2: sec("2026-09-17T00:00:00Z") });
    // Resistance falls 2711.9 over 11 days: one day before anchor 1, and 3 days after anchor 2.
    expect(res.price).toBeCloseTo(82282.8 + 2711.9 / 11, 1);
    expect(res.price2).toBeCloseTo(79570.9 - (3 * 2711.9) / 11, 1);
    expect(byId("w:sup").price).toBeCloseTo(76151.9, 1);
    expect(byId("w:sup").color).toBe(res.color); // one colour, the direction's
    expect(mapped.drawings.some((d) => d.id === "w:res:halo")).toBe(true);
  });

  it("continues both lines dashed to the apex", () => {
    for (const key of ["res", "sup"]) {
      expect(byId(`w:${key}:apex`)).toMatchObject({ time: sec("2026-09-17T00:00:00Z"), time2: sec("2026-10-14T00:00:00Z"), lineStyle: "dashed" });
    }
    // The lines converge: much narrower at the apex than at the formation end.
    const gapEnd = byId("w:res:apex").price - byId("w:sup:apex").price;
    const gapApex = byId("w:res:apex").price2! - byId("w:sup:apex").price2!;
    expect(Math.abs(gapApex)).toBeLessThan(gapEnd / 3);
  });

  it("projects target and stop past the last candle", () => {
    const start = ctx.lastBarSec! + 5 * DAY;
    expect(byId("w:target")).toMatchObject({ price: 85208.73, time: start, time2: start + 10 * DAY });
    expect(byId("w:stop")).toMatchObject({ price: 74718.25, color: "#ef4444" });
    const noBar = wedgePattern(falling, "w", { ...ctx, lastBarSec: null })!;
    expect(noBar.drawings.some((d) => d.id === "w:target" || d.id === "w:stop")).toBe(false);
  });

  it("names it, lists the levels by price and notes breakout and volume", () => {
    expect(mapped.name).toBe("Wedge · Falling");
    expect(mapped.levels.map((l) => l.label)).toEqual(["Target", "Breakout level", "Stop", "Apex"]);
    expect(mapped.note).toBe("Expected breakout: upward. Volume rose 9% during formation.");
    expect(wedgePattern({ ...falling, pattern_type: "WEDGE_RISING" }, "w", ctx)!.name).toBe("Wedge · Rising");
  });

  it("skips a pattern without both lines' anchors", () => {
    expect(wedgePattern({ ...falling, trendlines: { support: falling.trendlines.support } }, "w", ctx)).toBeNull();
  });
});
