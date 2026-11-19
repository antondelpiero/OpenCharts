import { TF_INTERVAL_MS, type DrawingLine, type Timeframe } from "../../pages/trading/constants";
import type { PatternResult } from "../../services/analysis";
import {
  DIRECTION_COLOR,
  DIRECTION_LABEL_DARK,
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
 * ELLIOT_WAVE pattern → drawings. The stored shape varies between runs (rules
 * from a prototype over ~1,060 stored patterns), so everything is read
 * defensively and mechanically:
 *
 * - `wave_structure` is iterated by key; key names are free-form
 *   (`wave_3`, `internal_wave_3`, `wave_4_forming`, `projected_wave_a`, …).
 * - a wave's end may be under `end_timestamp/price_end`, `latest_timestamp/
 *   price_latest` or `current_timestamp/current_price`; a wave with no end is
 *   skipped, never invented. Non-object members are skipped.
 * - `fibonacci_levels`: a `*_min`/`*_max` pair is a zone (rectangle), any other
 *   key a single level, both projected into the space right of the last candle.
 */

const DEGREE_STYLE: Record<string, { width: number; zIndex: number }> = {
  primary: { width: 3.5, zIndex: 1 },
  intermediate: { width: 2.5, zIndex: 2 },
};
const OTHER_DEGREE = { width: 2, zIndex: 3 };

const INVALIDATION_COLOR = "#ef4444";
interface Wave {
  key: string;
  start: Point;
  end: Point;
  forming: boolean;
}

function readWaves(structure: unknown): Wave[] {
  if (!structure || typeof structure !== "object") return [];
  const waves: Wave[] = [];
  for (const [key, raw] of Object.entries(structure as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue; // e.g. a `total_percent_move` number
    const w = raw as Record<string, unknown>;
    const start = point(w.start_timestamp, w.price_start);
    const end =
      point(w.end_timestamp, w.price_end) ??
      point(w.latest_timestamp, w.price_latest) ??
      point(w.current_timestamp, w.current_price);
    if (!start || !end) continue;
    waves.push({ key, start, end, forming: w.wave_status === "forming" });
  }
  return waves.sort((a, b) => a.start.timeSec - b.start.timeSec);
}

/** `internal_wave_3` → "3", `wave_A` → "A", `wave_4_forming` → "4"; null for long keys. */
export function waveLabel(key: string): string | null {
  const label = key
    .replace(/^(internal|forming|projected)_/, "")
    .replace(/^wave_/, "")
    .replace(/_forming$/, "")
    .toUpperCase();
  return label.length > 0 && label.length <= 3 && !label.includes("_") ? label : null;
}

/** `wave_4_support_min` → "Wave 4 support" (stem of a zone, or a single key). */
function humanizeKey(key: string): string {
  const words = key.replace(/_(min|max)$/, "").split("_");
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
}

interface Projected {
  key: string;
  max: number;
  min: number;
}

/** Group `fibonacci_levels` into zones (`*_min` + `*_max`) and single levels. */
function readTargets(levels: unknown): Projected[] {
  if (!levels || typeof levels !== "object") return [];
  const entries = Object.entries(levels as Record<string, unknown>).filter(
    (e): e is [string, number] => finite(e[1]),
  );
  const byKey = new Map(entries);
  const out: Projected[] = [];
  const used = new Set<string>();
  for (const [key, value] of entries) {
    if (used.has(key)) continue;
    const pair = key.endsWith("_min")
      ? key.replace(/_min$/, "_max")
      : key.endsWith("_max")
        ? key.replace(/_max$/, "_min")
        : null;
    const other = pair ? byKey.get(pair) : undefined;
    if (pair && other !== undefined) {
      used.add(key).add(pair);
      out.push({ key, max: Math.max(value, other), min: Math.min(value, other) });
    } else {
      used.add(key);
      out.push({ key, max: value, min: value });
    }
  }
  return out;
}

function tradeLevels(p: PatternResult): PatternLevel[] {
  const levels: PatternLevel[] = [];
  if (finite(p.invalidation_level)) levels.push({ label: "Invalidation", price: p.invalidation_level });
  if (finite(p.stop_loss)) levels.push({ label: "Stop", price: p.stop_loss });
  const entry = p.entry_zone as { max?: unknown; min?: unknown } | undefined;
  if (entry && finite(entry.max) && finite(entry.min)) {
    levels.push({ label: "Entry zone", price: entry.max }, { label: "Entry zone", price: entry.min });
  }
  const targets = p.targets && typeof p.targets === "object" ? (p.targets as Record<string, unknown>) : {};
  for (const [key, value] of Object.entries(targets)) {
    if (finite(value)) levels.push({ label: humanizeKey(key), price: value });
  }
  return levels;
}

/** `ELLIOT_WAVE_4` → "Wave 4", `ELLIOT_IMPULSE_COMPLETE` → "Impulse complete". */
function subtype(patternType: unknown): string | null {
  if (typeof patternType !== "string") return null;
  const rest = patternType.replace(/^ELLIOT_/, "").toLowerCase().replace(/_/g, " ");
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : null;
}

export function elliottPattern(p: PatternResult, id: string, ctx: MapContext): MappedPattern | null {
  const waves = readWaves(p.wave_structure);
  if (waves.length === 0) return null;

  const first = waves[0]!;
  const last = waves[waves.length - 1]!;
  const direction = last.end.price >= first.start.price ? "bullish" : "bearish";
  const style = { ...(DEGREE_STYLE[String(p.degree)] ?? OTHER_DEGREE), color: DIRECTION_COLOR[direction] };
  const labelColor = ctx.isDark ? DIRECTION_LABEL_DARK[direction] : DIRECTION_COLOR[direction];
  const drawings: DrawingLine[] = [];

  for (const wave of waves) {
    drawings.push(
      ...withHalo({
        id: `${id}:${wave.key}`,
        type: "trendline",
        time: wave.start.timeSec,
        price: wave.start.price,
        time2: wave.end.timeSec,
        price2: wave.end.price,
        color: style.color,
        width: style.width,
        lineStyle: wave.forming ? "dashed" : "solid",
        zIndex: style.zIndex,
        locked: true,
      }, ctx.isDark),
    );
    const text = waveLabel(wave.key);
    if (text) drawings.push(label(`${id}:${wave.key}:label`, text, wave.end, labelColor, ctx.isDark));
  }

  if (finite(p.invalidation_level)) {
    drawings.push({
      id: `${id}:inv`,
      type: "horizontal",
      price: p.invalidation_level,
      color: INVALIDATION_COLOR,
      width: 1,
      lineStyle: "dashed",
      locked: true,
    });
  }

  // Forward-looking levels, projected past the last candle so they read as
  // "the target is out there". A level equal to a wave end only restates
  // where that wave finished (e.g. `wave_3_target` once wave 3 is done): skip.
  const waveEnds = new Set(waves.map((w) => w.end.price));
  const intervalSec = (TF_INTERVAL_MS[ctx.timeframe as Timeframe] ?? 60_000) / 1000;
  if (ctx.lastBarSec !== null) {
    const time = ctx.lastBarSec + PROJECT_GAP_BARS * intervalSec;
    const time2 = time + PROJECT_WIDTH_BARS * intervalSec;
    for (const target of readTargets(p.fibonacci_levels)) {
      const isZone = target.max !== target.min;
      if (!isZone && waveEnds.has(target.max)) continue;
      const base = `${id}:target:${target.key}`;
      drawings.push(
        ...(isZone
          ? [{ id: base, type: "rectangle", time, price: target.max, time2, price2: target.min, color: style.color, locked: true } satisfies DrawingLine]
          : withHalo({ id: base, type: "trendline", time, price: target.max, time2, price2: target.max, color: style.color, width: 2.5, locked: true }, ctx.isDark)),
        label(`${base}:label`, humanizeKey(target.key), { timeSec: time, price: target.max }, labelColor, ctx.isDark, false),
      );
    }
  }

  const levels = tradeLevels(p);
  for (const target of readTargets(p.fibonacci_levels)) {
    if (target.max === target.min && waveEnds.has(target.max)) continue;
    if (levels.some((l) => l.price === target.max)) continue;
    const name = humanizeKey(target.key);
    if (target.max === target.min) levels.push({ label: name, price: target.max });
    else levels.push({ label: name, price: target.max }, { label: name, price: target.min });
  }

  const kind = subtype(p.pattern_type);
  return {
    drawings,
    levels,
    name: kind ? `Elliott · ${kind}` : "Elliott Wave",
    direction,
    note: typeof p.next_expectation === "string" ? p.next_expectation : null,
  };
}
