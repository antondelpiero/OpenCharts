import { describe, expect, it } from "vitest";
import { ANALYZER_FIB_LEVELS, fibonacciDrawing, fibonacciLevels, toUnixSeconds } from "../lib/pattern-overlays/fibonacci";
import { toExpiredOverlays, toOverlays } from "../lib/pattern-overlays";
import type { PairAnalysis } from "../services/analysis";

const sec = (iso: string) => Date.parse(iso) / 1000;

// Abridged from the deployed trading-api (staging), BTCUSDT 1d, 2026-11-18.
const bullish = {
  pattern_id: 126,
  pattern_type: "FIBONACCI_RET_75_0",
  direction: "bullish",
  confidence: 0.84,
  pattern_state: "AT_LEVEL",
  swing_points: {
    swing_low: { price: 57758.6, timestamp: "2026-07-01T00:00Z" },
    swing_high: { price: 87385.1, timestamp: "2026-09-21T00:00Z" },
  },
};

// Abridged from a stored BTCUSDT 4h row, 2026-11-17 (pattern_id stored as a string).
const bearish = {
  pattern_id: "126",
  pattern_type: "FIBONACCI_RET_75_0",
  direction: "bearish",
  confidence: 0.55,
  pattern_state: "APPROACHING",
  swing_points: {
    swing_low: { price: 61956.3, timestamp: "2026-11-15T00:00:00Z" },
    swing_high: { price: 85643.2, timestamp: "2026-10-06T20:00:00.000Z" },
  },
};

const entry = (overrides: Partial<PairAnalysis> = {}): PairAnalysis => ({
  symbol: "BTCUSDT",
  patternFamily: "FIBONACCI",
  timeframe: "1d",
  expiresAt: "2026-11-19T00:30:57.057Z",
  analysis: [bullish],
  ...overrides,
});

describe("fibonacciDrawing", () => {
  it("bullish: anchor 1 (level 1.0, the stop) is the swing low; anchor 2 (level 0) the high", () => {
    const d = fibonacciDrawing(bullish, "x")!;
    expect(d).toMatchObject({
      type: "fibonacci",
      price: 57758.6,
      time: sec("2026-07-01T00:00Z"),
      price2: 87385.1,
      time2: sec("2026-09-21T00:00Z"),
      extendRight: true,
      locked: true,
    });
    expect(d.fibLevels).toEqual(ANALYZER_FIB_LEVELS);
  });

  it("bearish: anchor 1 is the swing high, anchor 2 the low", () => {
    const d = fibonacciDrawing(bearish, "x")!;
    expect(d.price).toBe(85643.2);
    expect(d.time).toBe(sec("2026-10-06T20:00:00Z"));
    expect(d.price2).toBe(61956.3);
    expect(d.time2).toBe(sec("2026-11-15T00:00:00Z"));
  });

  it("places the analyzer's levels at the stored prices (level 1.0 = stop, 0 = target 1, -0.5 = target 2)", () => {
    const d = fibonacciDrawing(bearish, "x")!;
    const at = (level: number) => d.price2! + (d.price - d.price2!) * level; // resolve.ts formula
    expect(at(1)).toBeCloseTo(85643.2, 1);
    expect(at(0)).toBeCloseTo(61956.3, 1);
    expect(at(0.75)).toBeCloseTo(79721.5, 0);
    expect(at(-0.5)).toBeCloseTo(50112.9, 0);
  });

  it("skips a pattern with a missing swing timestamp instead of inventing an anchor", () => {
    const broken = {
      ...bullish,
      swing_points: { ...bullish.swing_points, swing_high: { price: 87385.1 } },
    };
    expect(fibonacciDrawing(broken, "x")).toBeNull();
  });

  it("skips a pattern with no known direction", () => {
    expect(fibonacciDrawing({ ...bullish, direction: "sideways" }, "x")).toBeNull();
  });
});

describe("fibonacciLevels", () => {
  it("lists stop, entry zone and targets at the analyzer's stored prices", () => {
    const levels = fibonacciLevels(fibonacciDrawing(bearish, "x")!);
    const price = (label: string) => levels.find((l) => l.label.startsWith(label))!.price;
    expect(price("Stop")).toBeCloseTo(85643.2, 1);
    expect(price("Entry zone (0.75)")).toBeCloseTo(79721.5, 0);
    expect(price("Entry zone (0.786)")).toBeCloseTo(80574.2, 0);
    expect(price("Target 1")).toBeCloseTo(61956.3, 1);
    expect(price("Target 2")).toBeCloseTo(50112.9, 0);
    expect(price("Target 3")).toBeCloseTo(47317.8, 0);
  });
});

describe("toUnixSeconds", () => {
  it("accepts the ISO variants the analyzer stores", () => {
    expect(toUnixSeconds("2026-06-24T00:00Z")).toBe(sec("2026-06-24T00:00:00Z"));
    expect(toUnixSeconds("2026-09-25T08:00:00.000Z")).toBe(sec("2026-09-25T08:00:00Z"));
  });

  it("rejects implausible times (e.g. milliseconds) and garbage", () => {
    expect(toUnixSeconds(String(Date.parse("2026-01-01T00:00:00Z")))).toBeNull();
    expect(toUnixSeconds("1970-01-01T00:00:00Z")).toBeNull();
    expect(toUnixSeconds("not a date")).toBeNull();
    expect(toUnixSeconds(undefined)).toBeNull();
  });
});

describe("toOverlays", () => {
  it("keeps only the chart's timeframe", () => {
    const overlays = toOverlays([entry(), entry({ timeframe: "4h", analysis: [bearish] })], "1d");
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.timeframe).toBe("1d");
  });

  it("keeps only the newest analysis when the backend returns two for the same family", () => {
    const older = entry({ expiresAt: "2026-11-18T10:00:00Z", analysis: [bearish] });
    const newer = entry({ expiresAt: "2026-11-19T00:30:57.057Z", analysis: [bullish] });
    const overlays = toOverlays([older, newer], "1d");
    expect(overlays).toHaveLength(1);
    expect(overlays[0]!.expiresAt).toBe(newer.expiresAt);
    expect(overlays[0]!.drawings[0]!.price).toBe(57758.6);
  });

  it("carries the trader-facing info and builds stable ids", () => {
    const [overlay] = toOverlays([entry()], "1d");
    expect(overlay).toMatchObject({
      family: "FIBONACCI",
      patternType: "FIBONACCI_RET_75_0",
      direction: "bullish",
      confidence: 0.84,
      patternState: "AT_LEVEL",
    });
    expect(overlay!.levels.map((l) => l.label)[0]).toBe("Stop (1.0)");
    expect(overlay!.id).toBe("FIBONACCI:1d:2026-11-19T00:30:57.057Z:0");
    expect(overlay!.drawings[0]!.id).toBe("FIBONACCI:1d:2026-11-19T00:30:57.057Z:0:fib");
    expect(toOverlays([entry()], "1d")[0]!.id).toBe(overlay!.id);
  });

  it("ignores families it cannot draw yet and empty results", () => {
    const overlays = toOverlays(
      [entry({ patternFamily: "ELLIOT_WAVE" }), entry({ patternFamily: "RANGE", analysis: null })],
      "1d",
    );
    expect(overlays).toEqual([]);
  });

  it("returns nothing for no data", () => {
    expect(toOverlays([], "1d")).toEqual([]);
  });
});

describe("toExpiredOverlays", () => {
  const now = Date.parse("2026-11-18T17:00:00Z");
  const expired1 = entry({ expiresAt: "2026-11-18T13:18:00Z", timeframe: "4h" });
  const expired2 = entry({ expiresAt: "2026-11-17T14:04:00Z", timeframe: "4h", analysis: [bearish] });
  const valid = entry({ expiresAt: "2026-11-19T00:30:57.057Z" });

  it("keeps only expired entries, every run of them", () => {
    const overlays = toExpiredOverlays([valid, expired1, expired2], true, now);
    expect(overlays.map((o) => o.expiresAt)).toEqual([expired1.expiresAt, expired2.expiresAt]);
    expect(overlays.every((o) => o.expired)).toBe(true);
  });

  it("draws an expired fib like a live one", () => {
    const [overlay] = toExpiredOverlays([expired2], true, now); // bearish fib
    const [live] = toOverlays([{ ...expired2, expiresAt: "2026-11-19T00:30:57.057Z" }], "4h");
    expect(overlay!.drawings.map((d) => ({ ...d, id: "" }))).toEqual(live!.drawings.map((d) => ({ ...d, id: "" })));
    expect(overlay!.drawings.some((d) => d.type === "fibonacci")).toBe(true);
  });

  it("leaves live overlays untouched", () => {
    const [live] = toOverlays([valid], "1d");
    expect(live!.expired).toBe(false);
    expect(live!.drawings[0]!.color).toBe("#2196F3");
  });
});
