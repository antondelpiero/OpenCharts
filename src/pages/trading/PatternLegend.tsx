import { useEffect, useRef } from "react";
import { Eye, EyeOff, X } from "lucide-react";
import type { PatternOverlay } from "../../lib/pattern-overlays";
import { cn } from "../../lib/utils.ts";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
/** "AT_LEVEL" → "At level" */
const humanize = (s: string) => capitalize(s.replace(/_/g, " "));
const percent = (c: number) => `${Math.round(c * 100)}%`;

function formatPrice(p: number): string {
  const digits = Math.abs(p) >= 100 ? 2 : Math.abs(p) >= 1 ? 4 : 6;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function directionClass(direction: string | null): string {
  if (direction === "bullish") return "text-buy";
  if (direction === "bearish") return "text-sell";
  return "text-muted-foreground";
}

interface LegendProps {
  patterns: PatternOverlay[];
  hiddenIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  /** Opens the info popup for `pattern`, anchored at the click position. */
  onSelect: (pattern: PatternOverlay, x: number, y: number) => void;
}

/**
 * The trading backend's detected patterns for this chart, drawn over the
 * chart's top-right corner: show/hide each one, click for details. Placed right
 * so it never collides with the indicator legend on the left.
 */
export function PatternLegend({ patterns, hiddenIds, onToggle, onSelect }: LegendProps) {
  if (patterns.length === 0) return null;

  return (
    // Clear of the price axis (~80px) on the right.
    <div className="absolute top-[52px] right-24 z-20 flex flex-col items-end gap-0.5 pointer-events-none">
      {patterns.map((pattern) => {
        const hidden = hiddenIds.has(pattern.id);
        return (
          <div
            key={pattern.id}
            className={cn(
              "pointer-events-auto flex items-center gap-1.5 px-1.5 py-0.5 rounded",
              "bg-card/70 backdrop-blur-sm border border-transparent hover:border-border cursor-pointer",
              hidden && "opacity-50",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(pattern, e.clientX, e.clientY);
            }}
            title="Click for details"
          >
            <span className="text-[11px] font-mono leading-none">
              {pattern.name}
              {pattern.direction && (
                <span className={cn("ml-1", directionClass(pattern.direction))}>
                  {capitalize(pattern.direction)}
                </span>
              )}
              {pattern.confidence != null && (
                <span className="ml-1 text-muted-foreground">{percent(pattern.confidence)}</span>
              )}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(pattern.id);
              }}
              className="text-muted-foreground hover:text-foreground"
              title={hidden ? "Show" : "Hide"}
            >
              {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface InfoPopupProps {
  pattern: PatternOverlay;
  hidden: boolean;
  /** Viewport coords to anchor the popup at. */
  x: number;
  y: number;
  onToggle: (id: string) => void;
  onClose: () => void;
}

/** Read-only details of one detected pattern. */
export function PatternInfoPopup({ pattern, hidden, x, y, onToggle, onClose }: InfoPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const rows: Array<[string, React.ReactNode]> = [];
  if (pattern.direction) {
    rows.push(["Direction", <span className={directionClass(pattern.direction)}>{capitalize(pattern.direction)}</span>]);
  }
  if (pattern.confidence != null) rows.push(["Confidence", percent(pattern.confidence)]);
  if (pattern.patternState) rows.push(["State", humanize(pattern.patternState)]);
  rows.push(["Valid until", new Date(pattern.expiresAt).toLocaleString()]);

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-64 bg-card border border-border rounded-lg shadow-xl p-2.5 text-xs"
      style={{ left: Math.min(x, window.innerWidth - 272), top: Math.min(y, window.innerHeight - 320) }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">
            {pattern.name} · {pattern.timeframe}
          </div>
          {pattern.patternType && (
            <div className="text-[10px] font-mono text-muted-foreground truncate">{pattern.patternType}</div>
          )}
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right">{value}</dd>
          </div>
        ))}
      </dl>

      {pattern.levels.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mt-2 pt-2 border-t border-border">
          {pattern.levels.map((level, i) => (
            <div key={`${level.label}:${i}`} className="contents">
              <dt className="text-muted-foreground">{level.label}</dt>
              <dd className="text-right font-mono">{formatPrice(level.price)}</dd>
            </div>
          ))}
        </dl>
      )}

      {pattern.note && (
        <p className="mt-2 pt-2 border-t border-border text-[11px] leading-snug text-muted-foreground">
          {pattern.note}
        </p>
      )}

      <div className="flex items-center justify-between mt-2.5">
        <span className="text-[10px] text-muted-foreground">Read-only analysis</span>
        <button
          onClick={() => onToggle(pattern.id)}
          className="flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-secondary"
        >
          {hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          {hidden ? "Show" : "Hide"}
        </button>
      </div>
    </div>
  );
}
