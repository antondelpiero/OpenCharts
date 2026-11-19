import { TF_INTERVAL_MS, type DrawingLine, type Timeframe } from "../../pages/trading/constants";
import type { PatternResult } from "../../services/analysis";
import { toUnixSeconds } from "./fibonacci";
import {
  DIRECTION_COLOR,
  DIRECTION_LABEL_DARK,
  PROJECT_GAP_BARS,
  PROJECT_WIDTH_BARS,
  finite,
  label,
  withHalo,
} from "./style";
import type { MapContext, MappedPattern, PatternLevel } from "./types";

/**
 * RANGE pattern → drawings: the range box over its formation period, support
 * (green) and resistance (red) carried to the right, a dashed midpoint, and
 * the measured-move breakout targets projected past the last candle.
 *
 * Read from `range_levels.{support,resistance}.price`, `range_levels.midpoint`,
 * `formation_period.start_timestamp/end_timestamp` and
 * `post_breakout_target.{bullish,bearish}_target`; a pattern without both
 * boundaries is skipped. Without a start time the boundaries are drawn as
 * plain horizontal lines.
 */

/** Box border/fill for a range that leans neither way. */
const NEUTRAL_COLOR = "#64748b";
const MIDPOINT_COLOR = "#8a8f98";
const BOX_FILL_OPACITY = 0.08;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

/** `MARKET_STRUCTURE_RANGE` → "Market structure", `RECTANGLE` → "Rectangle". */
function subtype(patternType: unknown): string | null {
  if (typeof patternType !== "string") return null;
  const rest = patternType.replace(/_?RANGE$/, "").toLowerCase().replace(/_/g, " ").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}

const fmt = (price: number) => price.toLocaleString("en-US", { maximumFractionDigits: 8 });

export function rangePattern(p: PatternResult, id: string, ctx: MapContext): MappedPattern | null {
  const levels = obj(p.range_levels);
  const support = obj(levels.support).price;
  const resistance = obj(levels.resistance).price;
  if (!finite(support) || !finite(resistance)) return null;
  const midpoint = finite(levels.midpoint) ? levels.midpoint : (support + resistance) / 2;

  const period = obj(p.formation_period);
  const start = toUnixSeconds(period.start_timestamp);
  const end = toUnixSeconds(period.end_timestamp);
  const direction = p.direction === "bullish" || p.direction === "bearish" ? p.direction : null;
  const labelColor = (d: "bullish" | "bearish") => (ctx.isDark ? DIRECTION_LABEL_DARK[d] : DIRECTION_COLOR[d]);
  const drawings: DrawingLine[] = [];

  /** A boundary from the range start, carried to the right edge. */
  const boundary = (key: string, price: number, color: string, width: number, dashed = false): DrawingLine =>
    start !== null
      ? { id: `${id}:${key}`, type: "trendline", time: start, price, time2: end ?? start, price2: price, extendRight: true, color, width, lineStyle: dashed ? "dashed" : "solid", locked: true }
      : { id: `${id}:${key}`, type: "horizontal", price, color, width, lineStyle: dashed ? "dashed" : "solid", locked: true };

  if (start !== null && end !== null && end > start) {
    const boxColor = direction ? DIRECTION_COLOR[direction] : NEUTRAL_COLOR;
    drawings.push({
      id: `${id}:box`,
      type: "rectangle",
      time: start,
      price: resistance,
      time2: end,
      price2: support,
      color: boxColor,
      fillColor: boxColor,
      fillOpacity: BOX_FILL_OPACITY,
      width: 1,
      locked: true,
    });
  }
  drawings.push(boundary("mid", midpoint, MIDPOINT_COLOR, 1, true));
  drawings.push(...withHalo(boundary("res", resistance, DIRECTION_COLOR.bearish, 2.5), ctx.isDark));
  drawings.push(...withHalo(boundary("sup", support, DIRECTION_COLOR.bullish, 2.5), ctx.isDark));
  if (start !== null) {
    drawings.push(
      label(`${id}:res:label`, `Resistance ${fmt(resistance)}`, { timeSec: start, price: resistance }, labelColor("bearish"), ctx.isDark),
      label(`${id}:sup:label`, `Support ${fmt(support)}`, { timeSec: start, price: support }, labelColor("bullish"), ctx.isDark),
    );
  }

  // Measured-move targets, projected past the last candle like Elliott's.
  const target = obj(p.post_breakout_target);
  const targets = [
    { key: "bull", price: target.bullish_target, text: "Breakout target", dir: "bullish" as const },
    { key: "bear", price: target.bearish_target, text: "Breakdown target", dir: "bearish" as const },
  ].filter((t): t is typeof t & { price: number } => finite(t.price) && t.price > 0);
  if (ctx.lastBarSec !== null) {
    const intervalSec = (TF_INTERVAL_MS[ctx.timeframe as Timeframe] ?? 60_000) / 1000;
    const time = ctx.lastBarSec + PROJECT_GAP_BARS * intervalSec;
    const time2 = time + PROJECT_WIDTH_BARS * intervalSec;
    for (const t of targets) {
      const base = `${id}:target:${t.key}`;
      drawings.push(
        ...withHalo({ id: base, type: "trendline", time, price: t.price, time2, price2: t.price, color: DIRECTION_COLOR[t.dir], width: 2.5, lineStyle: "dashed", locked: true }, ctx.isDark),
        label(`${base}:label`, t.text, { timeSec: time, price: t.price }, labelColor(t.dir), ctx.isDark, false),
      );
    }
  }

  const popupLevels: PatternLevel[] = [
    ...targets.filter((t) => t.dir === "bullish").map((t) => ({ label: t.text, price: t.price })),
    { label: "Resistance", price: resistance },
    { label: "Midpoint", price: midpoint },
    { label: "Support", price: support },
    ...targets.filter((t) => t.dir === "bearish").map((t) => ({ label: t.text, price: t.price })),
  ];

  const kind = subtype(p.pattern_type);
  return {
    drawings,
    levels: popupLevels,
    name: kind ? `Range · ${kind}` : "Range",
    note: note(p),
  };
}

/** "Breakout bias: bearish (55%). False-breakout risk: high." */
function note(p: PatternResult): string | null {
  const parts: string[] = [];
  const bias = obj(p.breakout_bias);
  if (bias.direction === "bullish" || bias.direction === "bearish") {
    const prob = bias.direction === "bullish" ? bias.probability_bullish_breakout : bias.probability_bearish_breakout;
    parts.push(`Breakout bias: ${bias.direction}${finite(prob) ? ` (${Math.round(prob * 100)}%)` : ""}.`);
  }
  const risk = obj(p.false_breakout_risk).level;
  if (typeof risk === "string" && risk) parts.push(`False-breakout risk: ${risk}.`);
  return parts.length > 0 ? parts.join(" ") : null;
}
