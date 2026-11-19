import type { DrawingLine } from "../../pages/trading/constants";
import { toUnixSeconds } from "./fibonacci";

/** Look shared by the pattern families (Elliott, range): colours, outline, labels, projections. */

/** Line colour by direction (Elliott sets the weight by degree). */
export const DIRECTION_COLOR = { bullish: "#16623a", bearish: "#881f1f" } as const;
/** Label text on the dark theme: the line colours are too dark to read there. */
export const DIRECTION_LABEL_DARK = { bullish: "#5cbf86", bearish: "#e06666" } as const;
/**
 * A wider, semi-transparent outline drawn under each coloured line, so the
 * waves separate from the red/green candles beneath them: whitish on the dark
 * theme, dark grey on the light one.
 */
const HALO_COLOR = { dark: "rgba(255, 255, 255, 0.5)", light: "rgba(17, 24, 39, 0.6)" } as const;
const HALO_EXTRA_WIDTH = 3.5;

/** `line` preceded by its outline (drawings render in list order, so it sits beneath). */
export function withHalo(line: DrawingLine, isDark: boolean): DrawingLine[] {
  const halo: DrawingLine = {
    ...line,
    id: `${line.id}:halo`,
    color: isDark ? HALO_COLOR.dark : HALO_COLOR.light,
    width: (line.width ?? 1.5) + HALO_EXTRA_WIDTH,
    lineStyle: "solid",
  };
  return [halo, line];
}

/** Invalidation / stop levels. */
export const INVALIDATION_COLOR = "#ef4444";

/** Wave-label background boxes, matched to the chart theme. */
export const LABEL_BG = { dark: "#1e222d", light: "#ffffff" } as const;

/** Targets are drawn this many bars past the last candle, this many bars wide. */
export const PROJECT_GAP_BARS = 5;
export const PROJECT_WIDTH_BARS = 10;

export interface Point {
  timeSec: number;
  price: number;
}

export const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function point(timestamp: unknown, price: unknown): Point | null {
  const timeSec = toUnixSeconds(timestamp);
  return timeSec !== null && finite(price) ? { timeSec, price } : null;
}

/**
 * A text label whose top-left corner sits at `at`. Wave labels get a background
 * box for legibility over candles; target labels don't, so the text sits just
 * under its level instead of covering it.
 */
export function label(
  id: string,
  text: string,
  at: Point,
  color: string,
  isDark: boolean,
  boxed = true,
): DrawingLine {
  return {
    id,
    type: "text",
    time: at.timeSec,
    price: at.price,
    text,
    color,
    fontSize: 11,
    textBg: boxed,
    textBgColor: isDark ? LABEL_BG.dark : LABEL_BG.light,
    locked: true,
  };
}
