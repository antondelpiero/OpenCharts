import { TF_INTERVAL_MS, type DrawingLine, type Timeframe } from "../../pages/trading/constants";
import type { PatternResult } from "../../services/analysis";
import { toUnixSeconds } from "./fibonacci";
import {
  DIRECTION_COLOR,
  DIRECTION_LABEL_DARK,
  INVALIDATION_COLOR,
  PROJECT_GAP_BARS,
  PROJECT_WIDTH_BARS,
  finite,
  label,
  point,
  withHalo,
  type Point,
} from "./style";
import type { MapContext, MappedPattern, PatternLevel } from "./types";

/**
 * WEDGE pattern → drawings: both wedge lines through their anchors across the
 * formation period, continued dashed to the apex (convergence point), and the
 * breakout target and stop projected past the last candle.
 *
 * Read from `trendlines.{support,resistance}.anchor_{1,2}.{timestamp,price}`,
 * `formation_period`, `convergence_point.estimated_timestamp` and
 * `breakout_projection.{target_price,stop_loss,breakout_level}`. A pattern
 * without both lines' anchors is skipped.
 */

const LINE_WIDTH = 2.5;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

interface Line {
  a: Point;
  b: Point;
}

function readLine(raw: unknown): Line | null {
  const line = obj(raw);
  const a = point(obj(line.anchor_1).timestamp, obj(line.anchor_1).price);
  const b = point(obj(line.anchor_2).timestamp, obj(line.anchor_2).price);
  return a && b && a.timeSec !== b.timeSec ? { a, b } : null;
}

/** The line's price at `timeSec` (extended through its anchors). */
function priceAt(line: Line, timeSec: number): number {
  const slope = (line.b.price - line.a.price) / (line.b.timeSec - line.a.timeSec);
  return line.a.price + slope * (timeSec - line.a.timeSec);
}

/** `WEDGE_FALLING` → "Falling". */
function subtype(patternType: unknown): string | null {
  if (typeof patternType !== "string") return null;
  const rest = patternType.replace(/^WEDGE_?/, "").toLowerCase().replace(/_/g, " ").trim();
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}

export function wedgePattern(p: PatternResult, id: string, ctx: MapContext): MappedPattern | null {
  const lines = obj(p.trendlines);
  const support = readLine(lines.support);
  const resistance = readLine(lines.resistance);
  if (!support || !resistance) return null;

  const direction = p.direction === "bullish" || p.direction === "bearish" ? p.direction : null;
  const color = direction ? DIRECTION_COLOR[direction] : "#64748b";
  const labelColor = (d: "bullish" | "bearish") => (ctx.isDark ? DIRECTION_LABEL_DARK[d] : DIRECTION_COLOR[d]);

  const period = obj(p.formation_period);
  const anchorTimes = [support.a, support.b, resistance.a, resistance.b].map((pt) => pt.timeSec);
  const start = toUnixSeconds(period.start_timestamp) ?? Math.min(...anchorTimes);
  const end = Math.max(toUnixSeconds(period.end_timestamp) ?? start, ...anchorTimes);
  const apex = toUnixSeconds(obj(p.convergence_point).estimated_timestamp);

  const drawings: DrawingLine[] = [];
  for (const [key, line] of [["res", resistance], ["sup", support]] as const) {
    drawings.push(
      ...withHalo(
        { id: `${id}:${key}`, type: "trendline", time: start, price: priceAt(line, start), time2: end, price2: priceAt(line, end), color, width: LINE_WIDTH, locked: true },
        ctx.isDark,
      ),
    );
    if (apex !== null && apex > end) {
      drawings.push({ id: `${id}:${key}:apex`, type: "trendline", time: end, price: priceAt(line, end), time2: apex, price2: priceAt(line, apex), color, width: 1.5, lineStyle: "dashed", locked: true });
    }
  }

  const proj = obj(p.breakout_projection);
  const target = finite(proj.target_price) && proj.target_price > 0 ? proj.target_price : null;
  const stop = finite(proj.stop_loss) && proj.stop_loss > 0 ? proj.stop_loss : null;
  if (ctx.lastBarSec !== null) {
    const intervalSec = (TF_INTERVAL_MS[ctx.timeframe as Timeframe] ?? 60_000) / 1000;
    const time = ctx.lastBarSec + PROJECT_GAP_BARS * intervalSec;
    const time2 = time + PROJECT_WIDTH_BARS * intervalSec;
    if (target !== null) {
      drawings.push(
        ...withHalo({ id: `${id}:target`, type: "trendline", time, price: target, time2, price2: target, color, width: LINE_WIDTH, lineStyle: "dashed", locked: true }, ctx.isDark),
        label(`${id}:target:label`, "Target", { timeSec: time, price: target }, direction ? labelColor(direction) : color, ctx.isDark, false),
      );
    }
    if (stop !== null) {
      drawings.push(
        { id: `${id}:stop`, type: "trendline", time, price: stop, time2, price2: stop, color: INVALIDATION_COLOR, width: 1.5, lineStyle: "dashed", locked: true },
        label(`${id}:stop:label`, "Stop", { timeSec: time, price: stop }, INVALIDATION_COLOR, ctx.isDark, false),
      );
    }
  }

  const levels: PatternLevel[] = [];
  if (target !== null) levels.push({ label: "Target", price: target });
  if (finite(proj.breakout_level)) levels.push({ label: "Breakout level", price: proj.breakout_level });
  if (stop !== null) levels.push({ label: "Stop", price: stop });
  const apexPrice = obj(p.convergence_point).estimated_price;
  if (finite(apexPrice)) levels.push({ label: "Apex", price: apexPrice });
  levels.sort((x, y) => y.price - x.price);

  const kind = subtype(p.pattern_type);
  return { drawings, levels, name: kind ? `Wedge · ${kind}` : "Wedge", note: note(p) };
}

/** "Expected breakout: upward. Volume fell 12% during formation." */
function note(p: PatternResult): string | null {
  const parts: string[] = [];
  const dir = obj(p.breakout_projection).expected_direction;
  if (typeof dir === "string" && dir) parts.push(`Expected breakout: ${dir}.`);
  const decline = obj(p.volume_analysis).volume_decline_percent;
  if (finite(decline) && decline !== 0) {
    parts.push(`Volume ${decline > 0 ? "fell" : "rose"} ${Math.abs(Math.round(decline))}% during formation.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
