import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff, LineChart } from "lucide-react";
import type { PatternOverlay } from "../../lib/pattern-overlays";
import { capitalize, directionClass, humanize, percent } from "../../lib/pattern-overlays/format";
import { cn } from "../../lib/utils.ts";
import { groupByTimeframe } from "../../lib/pattern-overlays/group";
import type { Timeframe } from "./constants";
import { PatternDetails } from "./PatternLegend.tsx";

interface PatternsPanelProps {
  symbol: string;
  /** Every detected pattern for the symbol, across all timeframes. */
  patterns: PatternOverlay[];
  /** The timeframe the chart is showing. */
  timeframe: Timeframe;
  /** Timeframe whose group is listed first. */
  leadingTimeframe: string | null;
  hiddenIds: ReadonlySet<string>;
  loading: boolean;
  /** The analysis backend could not be reached. */
  unavailable: boolean;
  onToggle: (id: string) => void;
  /** Switch the chart to a pattern's timeframe. */
  onShowTimeframe: (timeframe: Timeframe) => void;
}

/** "in 7h", "in 25m" until an ISO timestamp. */
function expiresIn(iso: string): string {
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  if (mins <= 0) return "expired";
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 48 ? `in ${hours}h` : `in ${Math.round(hours / 24)}d`;
}

/**
 * Right-panel list of everything the trading backend detected for the symbol,
 * grouped by timeframe, the one being looked at first. A row expands to the same details as the chart popup;
 * patterns on another timeframe can be brought onto the chart from here.
 */
export function PatternsPanel({
  symbol,
  patterns,
  timeframe,
  leadingTimeframe,
  hiddenIds,
  loading,
  unavailable,
  onToggle,
  onShowTimeframe,
}: PatternsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = groupByTimeframe(patterns, leadingTimeframe);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Detected Patterns
        </h3>
        <span className="text-xs font-semibold">{symbol}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-3 text-xs text-muted-foreground">Loading analysis…</p>
        ) : unavailable ? (
          <p className="p-3 text-xs text-muted-foreground">
            The analysis service is not reachable right now.
          </p>
        ) : patterns.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground leading-relaxed">
            No valid analysis for {symbol} right now. Each analysis is valid for one bar of its
            timeframe, so this list fills again after the next run.
          </p>
        ) : (
          groups.map((group) => {
            const onChart = group.timeframe === timeframe;
            return (
              <section key={group.timeframe} className="border-b border-border">
                <div className="flex items-center justify-between px-3 py-1.5 bg-card sticky top-0 z-10">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{group.timeframe}</span>
                  {onChart ? (
                    <span className="text-[10px] text-primary">on chart</span>
                  ) : (
                    <button
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => onShowTimeframe(group.timeframe as Timeframe)}
                      title={`Switch the chart to ${group.timeframe}`}
                    >
                      <LineChart className="h-3 w-3" />
                      Show on chart
                    </button>
                  )}
                </div>

                {group.patterns.map((pattern) => {
                  const hidden = hiddenIds.has(pattern.id);
                  const open = expanded === pattern.id;
                  return (
                    <div key={pattern.id} className={cn("px-3", hidden && "opacity-50")}>
                      <div
                        className="flex items-center gap-1.5 py-1.5 cursor-pointer"
                        onClick={() => setExpanded(open ? null : pattern.id)}
                      >
                        {open ? (
                          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate">{pattern.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {pattern.direction && (
                              <span className={directionClass(pattern.direction)}>
                                {capitalize(pattern.direction)}
                              </span>
                            )}
                            {pattern.confidence != null && <> · {percent(pattern.confidence)}</>}
                            {pattern.patternState && <> · {humanize(pattern.patternState)}</>}
                            <> · expires {expiresIn(pattern.expiresAt)}</>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggle(pattern.id);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                          title={hidden ? "Show" : "Hide"}
                        >
                          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {open && (
                        <div className="pb-2.5 pl-5 text-xs">
                          {pattern.patternType && (
                            <div className="mb-1.5 text-[10px] font-mono text-muted-foreground">
                              {pattern.patternType}
                            </div>
                          )}
                          <PatternDetails pattern={pattern} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
