import type { DrawingLine } from "../../pages/trading/constants";
import type { PatternResult } from "../../services/analysis";
import type { PatternLevel } from "./types";

/**
 * The analyzer's levels: the usual retracements plus its 0.75–0.786 entry band
 * and the −0.5 / −0.618 extensions it uses as second and third targets. Set per
 * drawing (`fibLevels`), so the default grid for hand-drawn fibs is untouched.
 * Colours are positional in resolve.ts, so the entry band is placed where it
 * still gets distinct colours.
 */
export const ANALYZER_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.75, 0.786, 1, -0.5, -0.618];

const FIB_COLOR = "#2196F3";

/** Plausible unix-second range; a millisecond value would be ~1000× larger. */
const MIN_SEC = 1.6e9;
const MAX_SEC = 2.0e9;

interface SwingPoint {
  price: number;
  timeSec: number;
}

/** ISO timestamp → unix seconds, or null when missing or implausible. */
export function toUnixSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const sec = Math.floor(ms / 1000);
  return sec >= MIN_SEC && sec <= MAX_SEC ? sec : null;
}

function swingPoint(value: unknown): SwingPoint | null {
  if (!value || typeof value !== "object") return null;
  const { price, timestamp } = value as { price?: unknown; timestamp?: unknown };
  const timeSec = toUnixSeconds(timestamp);
  if (typeof price !== "number" || !Number.isFinite(price) || timeSec === null) return null;
  return { price, timeSec };
}

/**
 * One FIBONACCI pattern → one `fibonacci` drawing, or null when it can't be
 * placed (missing swing point, unknown direction). Never invents an anchor.
 *
 * Anchor order follows resolve.ts (`price = price2 + (price - price2) * level`):
 * anchor 1 is level 1.0 (the swing origin, i.e. the stop) and anchor 2 is
 * level 0 (the swing extreme, i.e. the first target).
 */
export function fibonacciDrawing(pattern: PatternResult, id: string): DrawingLine | null {
  const swings = pattern.swing_points as { swing_high?: unknown; swing_low?: unknown } | undefined;
  const high = swingPoint(swings?.swing_high);
  const low = swingPoint(swings?.swing_low);
  if (!high || !low) return null;

  let origin: SwingPoint;
  let extreme: SwingPoint;
  if (pattern.direction === "bullish") {
    origin = low;
    extreme = high;
  } else if (pattern.direction === "bearish") {
    origin = high;
    extreme = low;
  } else {
    return null;
  }

  return {
    id,
    type: "fibonacci",
    time: origin.timeSec,
    price: origin.price,
    time2: extreme.timeSec,
    price2: extreme.price,
    color: FIB_COLOR,
    fibLevels: ANALYZER_FIB_LEVELS,
    // Levels stay relevant after the swing, so run them to the chart's right edge.
    extendRight: true,
    locked: true,
  };
}

/**
 * The levels the analyzer trades from, read off the drawing's anchors with the
 * same formula the chart uses (`price2 + (price - price2) * level`). Listed from
 * the stop toward the targets, so the order reads right for bullish and bearish
 * alike (which is why the entry band isn't labelled "high"/"low").
 */
export function fibonacciLevels(d: DrawingLine): PatternLevel[] {
  if (d.price2 == null) return [];
  const at = (level: number) => d.price2! + (d.price - d.price2!) * level;
  return [
    { label: "Stop (1.0)", price: at(1) },
    { label: "Entry zone (0.786)", price: at(0.786) },
    { label: "Entry zone (0.75)", price: at(0.75) },
    { label: "Target 1 (0)", price: at(0) },
    { label: "Target 2 (−0.5)", price: at(-0.5) },
    { label: "Target 3 (−0.618)", price: at(-0.618) },
  ];
}
