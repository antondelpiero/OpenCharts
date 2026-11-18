import { describe, expect, it } from "vitest";
import { elliottPattern, waveLabel } from "../lib/pattern-overlays/elliott";
import type { MapContext } from "../lib/pattern-overlays/types";
import type { DrawingLine } from "../pages/trading/constants";

const sec = (iso: string) => Date.parse(iso) / 1000;
const DAY = 86_400;
const ctx: MapContext = { timeframe: "1d", lastBarSec: sec("2026-11-18T00:00:00Z"), isDark: true };

// Abridged from the deployed trading-api (staging), BTCUSDT 1d, 2026-11-18.
const impulse = {
  pattern_type: "ELLIOT_IMPULSE_COMPLETE",
  degree: "primary",
  confidence: 0.86,
  wave_status: "completed",
  invalidation_level: 58030,
  wave_structure: {
    wave_1: { price_start: 58030, start_timestamp: "2026-06-25T00:00:00Z", price_end: 65130, end_timestamp: "2026-07-14T00:00:00Z" },
    wave_2: { price_start: 65130, start_timestamp: "2026-07-14T00:00:00Z", price_end: 63666, end_timestamp: "2026-07-24T00:00:00Z" },
    wave_3: { price_start: 63666, start_timestamp: "2026-07-24T00:00:00Z", price_end: 81500, end_timestamp: "2026-08-28T00:00:00Z" },
    wave_4: { price_start: 81500, start_timestamp: "2026-08-28T00:00:00Z", price_end: 76402.9, end_timestamp: "2026-09-10T00:00:00Z" },
    wave_5: { price_start: 76402.9, start_timestamp: "2026-09-10T00:00:00Z", price_end: 87249.6, end_timestamp: "2026-10-02T00:00:00Z" },
  },
  fibonacci_levels: { wave_3_target: 81500, wave_5_target: 87249.6, wave_4_support_max: 78000, wave_4_support_min: 76400 },
  next_expectation: "After the completed up impulse, a 3-wave correction is expected.",
};

const wave4Forming = {
  pattern_type: "ELLIOT_WAVE_4",
  degree: "intermediate",
  confidence: 0.68,
  wave_status: "forming",
  invalidation_level: 80345,
  stop_loss: 80350,
  entry_zone: { max: 76100, min: 70700 },
  targets: { target_1: 57690, target_2: 55050, target_3: 53200 },
  wave_structure: {
    wave_3: { price_start: 84875.2, start_timestamp: "2026-10-21T00:00:00Z", price_end: 61956.3, end_timestamp: "2026-11-15T00:00:00Z" },
    wave_4: { price_start: 61956.3, start_timestamp: "2026-11-15T00:00:00Z", price_end: 64535.6, end_timestamp: "2026-11-17T00:00:00Z", wave_status: "forming" },
  },
  fibonacci_levels: { wave_3_target: 61956.3, wave_5_target: 55050, wave_4_support_max: 76100, wave_4_support_min: 70700 },
};

const byType = (drawings: DrawingLine[], type: string) => drawings.filter((d) => d.type === type);
const isTarget = (d: DrawingLine) => d.id.includes(":target:");
const isHalo = (d: DrawingLine) => d.id.endsWith(":halo");

describe("elliottPattern", () => {
  it("draws one trendline per wave, chained into an unbroken zig-zag", () => {
    const { drawings } = elliottPattern(impulse, "p", ctx)!;
    const waves = byType(drawings, "trendline").filter((d) => !isTarget(d) && !isHalo(d));
    expect(waves).toHaveLength(5);
    for (let i = 1; i < waves.length; i++) {
      const prev = waves[i - 1]!;
      const next = waves[i]!;
      expect(next.time).toBe(prev.time2);
      expect(next.price).toBe(prev.price2);
    }
  });

  it("labels each wave at its end anchor", () => {
    const { drawings } = elliottPattern(impulse, "p", ctx)!;
    const labels = byType(drawings, "text").filter((d) => !isTarget(d));
    expect(labels.map((l) => l.text)).toEqual(["1", "2", "3", "4", "5"]);
    expect(labels[4]).toMatchObject({ time: sec("2026-10-02T00:00:00Z"), price: 87249.6 });
  });

  it("dashes a forming wave and styles by degree", () => {
    const { drawings } = elliottPattern(wave4Forming, "p", ctx)!;
    const w3 = drawings.find((d) => d.id === "p:wave_3")!;
    const w4 = drawings.find((d) => d.id === "p:wave_4")!;
    expect(w3.lineStyle).toBe("solid");
    expect(w4.lineStyle).toBe("dashed");
    const primary = elliottPattern(impulse, "q", ctx)!.drawings.find((d) => d.id === "q:wave_1")!;
    expect(primary.width!).toBeGreaterThan(w3.width!);
  });

  it("colours by direction: dark green bullish, dark red bearish", () => {
    const up = elliottPattern(impulse, "p", ctx)!.drawings.find((d) => d.id === "p:wave_1")!;
    const down = elliottPattern(wave4Forming, "p", ctx)!.drawings.find((d) => d.id === "p:wave_3")!;
    expect(up.color).toBe("#16623a");
    expect(down.color).toBe("#881f1f");
    // labels stay readable on the dark theme
    const label = elliottPattern(impulse, "p", ctx)!.drawings.find((d) => d.id === "p:wave_1:label")!;
    expect(label.color).toBe("#5cbf86");
  });

  it("draws a darker, wider halo directly beneath each wave line", () => {
    const { drawings } = elliottPattern(impulse, "p", ctx)!;
    const i = drawings.findIndex((d) => d.id === "p:wave_1");
    const halo = drawings[i - 1]!;
    expect(halo.id).toBe("p:wave_1:halo");
    expect(halo).toMatchObject({ time: drawings[i]!.time, price2: drawings[i]!.price2, lineStyle: "solid" });
    expect(halo.width!).toBeGreaterThan(drawings[i]!.width!);
  });

  it("uses a whitish outline on the dark theme and a dark one on the light theme", () => {
    const halo = (isDark: boolean) =>
      elliottPattern(impulse, "p", { ...ctx, isDark })!.drawings.find((d) => d.id === "p:wave_1:halo")!.color;
    expect(halo(true)).toMatch(/^rgba\(255, 255, 255/);
    expect(halo(false)).toMatch(/^rgba\(17, 24, 39/);
    const labelBg = (isDark: boolean) =>
      elliottPattern(impulse, "p", { ...ctx, isDark })!.drawings.find((d) => d.id === "p:wave_1:label")!.textBgColor;
    expect(labelBg(true)).toBe("#1e222d");
    expect(labelBg(false)).toBe("#ffffff");
  });

  it("draws the invalidation level as a horizontal line", () => {
    const { drawings } = elliottPattern(impulse, "p", ctx)!;
    expect(drawings.find((d) => d.id === "p:inv")).toMatchObject({ type: "horizontal", price: 58030 });
  });

  it("projects a min/max zone as a rectangle 5–15 bars past the last candle", () => {
    const { drawings } = elliottPattern(impulse, "p", ctx)!;
    const zone = drawings.find((d) => d.id === "p:target:wave_4_support_max")!;
    expect(zone).toMatchObject({
      type: "rectangle",
      price: 78000,
      price2: 76400,
      time: ctx.lastBarSec! + 5 * DAY,
      time2: ctx.lastBarSec! + 15 * DAY,
    });
  });

  it("skips 'targets' that only restate where a wave ended, projects real ones", () => {
    const impulseIds = elliottPattern(impulse, "p", ctx)!.drawings.map((d) => d.id);
    expect(impulseIds).not.toContain("p:target:wave_3_target"); // = wave 3 end
    expect(impulseIds).not.toContain("p:target:wave_5_target"); // = wave 5 end
    const forming = elliottPattern(wave4Forming, "p", ctx)!.drawings;
    expect(forming.find((d) => d.id === "p:target:wave_5_target")).toMatchObject({
      type: "trendline",
      price: 55050,
      price2: 55050,
    });
  });

  it("leaves projections out until the last candle is known", () => {
    const { drawings } = elliottPattern(impulse, "p", { timeframe: "1d", lastBarSec: null, isDark: true })!;
    expect(drawings.some((d) => d.id.includes(":target:"))).toBe(false);
    expect(drawings.some((d) => d.id === "p:wave_1")).toBe(true);
  });

  it("derives direction, name, note and the trade levels", () => {
    const up = elliottPattern(impulse, "p", ctx)!;
    expect(up.direction).toBe("bullish");
    expect(up.name).toBe("Elliott · Impulse complete");
    expect(up.note).toContain("3-wave correction");

    const down = elliottPattern(wave4Forming, "p", ctx)!;
    expect(down.direction).toBe("bearish");
    expect(down.name).toBe("Elliott · Wave 4");
    expect(down.levels.map((l) => `${l.label} ${l.price}`)).toEqual([
      "Invalidation 80345",
      "Stop 80350",
      "Entry zone 76100",
      "Entry zone 70700",
      "Target 1 57690",
      "Target 2 55050",
      "Target 3 53200",
    ]);
  });

  it("reads alias end fields, skips non-objects and waves without an end", () => {
    const messy = {
      degree: "minor",
      wave_structure: {
        total_percent_move: 12.5,
        wave_1: { price_start: 100, start_timestamp: "2026-01-01T00:00Z", price_latest: 110, latest_timestamp: "2026-01-05T00:00Z" },
        wave_2: { price_start: 110, start_timestamp: "2026-01-05T00:00Z", current_price: 105, current_timestamp: "2026-01-08T00:00Z" },
        wave_3: { price_start: 105, start_timestamp: "2026-01-08T00:00Z" },
      },
    };
    const { drawings } = elliottPattern(messy, "m", { timeframe: "1d", lastBarSec: null, isDark: true })!;
    expect(byType(drawings, "trendline").filter((d) => !isHalo(d)).map((d) => d.id)).toEqual(["m:wave_1", "m:wave_2"]);
    expect(drawings.find((d) => d.id === "m:wave_2")).toMatchObject({ price2: 105 });
  });

  it("returns null when no wave can be drawn", () => {
    expect(elliottPattern({ wave_structure: {} }, "x", ctx)).toBeNull();
    expect(elliottPattern({}, "x", ctx)).toBeNull();
  });
});

describe("waveLabel", () => {
  it("strips the free-form prefixes and suffixes", () => {
    expect(waveLabel("wave_3")).toBe("3");
    expect(waveLabel("internal_wave_3")).toBe("3");
    expect(waveLabel("wave_A")).toBe("A");
    expect(waveLabel("wave_4_forming")).toBe("4");
    expect(waveLabel("forming_wave_4")).toBe("4");
    expect(waveLabel("projected_wave_a")).toBe("A");
  });

  it("gives no label for long descriptive keys", () => {
    expect(waveLabel("abc_correction_after_impulse")).toBeNull();
    expect(waveLabel("wave_5_top_reference")).toBeNull();
  });
});
