import { describe, expect, it } from "vitest";
import { groupByTimeframe, overlayTimeframe } from "../lib/pattern-overlays/group";
import type { PatternOverlay } from "../lib/pattern-overlays/types";

const p = (timeframe: string, id = timeframe): PatternOverlay => ({
  id,
  family: "FIBONACCI",
  timeframe,
  name: "Fibonacci",
  patternType: null,
  direction: null,
  confidence: null,
  patternState: null,
  expiresAt: "2026-11-19T00:00:00Z",
  expired: false,
  levels: [],
  note: null,
  drawings: [],
});

const order = (groups: { timeframe: string }[]) => groups.map((g) => g.timeframe);

describe("groupByTimeframe", () => {
  const all = [p("15m"), p("1d"), p("4h"), p("1w"), p("1h")];

  it("orders largest timeframe first without a leading one", () => {
    expect(order(groupByTimeframe(all, null))).toEqual(["1w", "1d", "4h", "1h", "15m"]);
  });

  it("moves the leading timeframe to the top, keeping the rest in order", () => {
    expect(order(groupByTimeframe(all, "4h"))).toEqual(["4h", "1w", "1d", "1h", "15m"]);
    expect(order(groupByTimeframe(all, "15m"))).toEqual(["15m", "1w", "1d", "4h", "1h"]);
  });

  it("ignores a leading timeframe that has no patterns", () => {
    expect(order(groupByTimeframe([p("1d"), p("4h")], "1w"))).toEqual(["1d", "4h"]);
  });

  it("keeps every pattern of a timeframe in its group", () => {
    const groups = groupByTimeframe([p("1d", "a"), p("4h", "b"), p("1d", "c")], "1d");
    expect(groups[0]!.patterns.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("puts unknown timeframes last", () => {
    expect(order(groupByTimeframe([p("3d"), p("1h"), p("1d")], null))).toEqual(["1d", "1h", "3d"]);
  });
});

describe("overlayTimeframe", () => {
  it("uses the charted timeframe when it has patterns", () => {
    expect(overlayTimeframe(["15m", "1h", "1d"], "15m")).toBe("15m");
  });

  it("falls back to the closest larger timeframe with patterns", () => {
    expect(overlayTimeframe(["1h", "1d"], "15m")).toBe("1h");
    expect(overlayTimeframe(["4h", "1d"], "15m")).toBe("4h");
    expect(overlayTimeframe(["1d", "1w"], "1h")).toBe("1d");
  });

  it("never falls back to a smaller timeframe", () => {
    expect(overlayTimeframe(["15m", "1h"], "4h")).toBeNull();
    expect(overlayTimeframe(["1d"], "1w")).toBeNull();
  });

  it("returns null without patterns or for an unknown timeframe", () => {
    expect(overlayTimeframe([], "15m")).toBeNull();
    expect(overlayTimeframe(["1d"], "3d")).toBeNull();
  });
});
