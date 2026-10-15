import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { describeIndicator, type IndicatorInstance } from "../../lib/indicators.ts";
import { cn } from "../../lib/utils.ts";

/** Readable labels for the numeric params each indicator exposes. */
const PARAM_LABELS: Record<string, string> = {
  period: "Period",
  fast: "Fast",
  slow: "Slow",
  signal: "Signal",
  stdDev: "Std Dev",
  kPeriod: "%K Period",
  dPeriod: "%D Period",
};

interface EditPopupProps {
  instance: IndicatorInstance;
  /** Viewport coords to anchor the popup at. */
  x: number;
  y: number;
  onApply: (id: string, params: Record<string, number>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

/**
 * Settings popup for one indicator instance — opened from a legend row or by
 * clicking the plotted line. Edits are local until applied so a half-typed
 * period never reaches the chart.
 */
export function IndicatorEditPopup({
  instance,
  x,
  y,
  onApply,
  onRemove,
  onClose,
}: EditPopupProps) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(instance.params).map(([k, v]) => [k, String(v)])),
  );
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

  const apply = () => {
    const params: Record<string, number> = {};
    for (const [key, raw] of Object.entries(draft)) {
      const n = parseFloat(raw);
      // Ignore blank/invalid entries rather than writing NaN into the chart.
      params[key] = Number.isFinite(n) && n > 0 ? n : instance.params[key]!;
    }
    onApply(instance.id, params);
    onClose();
  };

  const keys = Object.keys(instance.params);

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-52 bg-card border border-border rounded-lg shadow-xl p-2.5"
      style={{ left: Math.min(x, window.innerWidth - 220), top: Math.min(y, window.innerHeight - 200) }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: instance.color }}
        />
        <span className="text-xs font-semibold flex-1">{describeIndicator(instance)}</span>
      </div>

      {keys.length === 0 ? (
        <p className="text-[11px] text-muted-foreground mb-2">No settings for this indicator.</p>
      ) : (
        <div className="space-y-1.5 mb-2">
          {keys.map((key) => (
            <label key={key} className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground flex-1">
                {PARAM_LABELS[key] ?? key}
              </span>
              <input
                type="number"
                min="1"
                value={draft[key] ?? ""}
                autoFocus={key === keys[0]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") apply();
                }}
                className="w-16 text-xs text-center"
              />
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {keys.length > 0 && (
          <button
            onClick={apply}
            className="flex-1 text-xs py-1 rounded bg-accent text-accent-foreground hover:opacity-90"
          >
            Apply
          </button>
        )}
        <button
          onClick={() => {
            onRemove(instance.id);
            onClose();
          }}
          className="flex-1 text-xs py-1 rounded border border-border hover:bg-destructive hover:text-destructive-foreground"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

interface LegendProps {
  instances: IndicatorInstance[];
  /** Opens the edit popup for `instance`, anchored at the click position. */
  onSelect: (instance: IndicatorInstance, x: number, y: number) => void;
  onRemove: (id: string) => void;
}

/**
 * Per-instance rows drawn over the chart's top-left corner. These are the
 * reliable click target for editing an indicator — hitting the 1px plotted
 * line is possible but fiddly, especially where a moving-average ribbon
 * converges.
 */
export function IndicatorLegend({ instances, onSelect, onRemove }: LegendProps) {
  if (instances.length === 0) return null;

  return (
    // Offset past the drawing tool rail (absolute left-1, ~34px wide) so the
    // rail's buttons don't sit on top of these rows and swallow their clicks.
    <div className="absolute top-[52px] left-11 z-20 flex flex-col items-start gap-0.5 pointer-events-none">
      {instances.map((instance) => (
        <div
          key={instance.id}
          className={cn(
            "pointer-events-auto group flex items-center gap-1.5 px-1.5 py-0.5 rounded",
            "bg-card/70 backdrop-blur-sm border border-transparent hover:border-border cursor-pointer",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(instance, e.clientX, e.clientY);
          }}
          title="Click to edit or remove"
        >
          <span
            className="w-2 h-0.5 rounded-full shrink-0"
            style={{ backgroundColor: instance.color }}
          />
          <span className="text-[11px] font-mono leading-none">
            {describeIndicator(instance)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(instance.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            title="Remove"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
