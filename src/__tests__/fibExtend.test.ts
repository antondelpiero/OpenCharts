import { describe, expect, it } from "vitest";
import { hitTest } from "../lib/chart-plugins/drawing-tools/hit-test";
import type { ResolvedEntry } from "../lib/chart-plugins/drawing-tools/types";
import type { DrawingLine } from "../pages/trading/constants";

/** A fib between x=100 and x=200 with one level line at y=50. */
function fib(extra: Partial<DrawingLine> = {}): ResolvedEntry {
  return {
    d: { id: "f", type: "fibonacci", price: 1, price2: 0, time: 1, time2: 2, color: "#2196F3", ...extra },
    x1: 100,
    y1: 80,
    x2: 200,
    y2: 20,
    fibLevels: [{ level: 0.5, price: 0.5, y: 50, color: "#fff", label: "0.5" }],
    state: "normal",
  };
}

describe("fibonacci extend", () => {
  it("is not hit beyond its anchors by default", () => {
    expect(hitTest([fib()], { x: 400, y: 50 })).toBeNull();
    expect(hitTest([fib()], { x: 20, y: 50 })).toBeNull();
  });

  it("extendRight makes the level clickable to the right of the second anchor", () => {
    expect(hitTest([fib({ extendRight: true })], { x: 400, y: 50 })).not.toBeNull();
    expect(hitTest([fib({ extendRight: true })], { x: 20, y: 50 })).toBeNull();
  });

  it("extendLeft makes the level clickable to the left of the first anchor", () => {
    expect(hitTest([fib({ extendLeft: true })], { x: 20, y: 50 })).not.toBeNull();
  });
});
