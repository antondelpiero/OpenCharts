import { useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import type { PatternOverlay } from "../../lib/pattern-overlays";
import { capitalize, directionClass, humanize, percent } from "../../lib/pattern-overlays/format";
import { groupByTimeframe, type TimeframeGroup } from "../../lib/pattern-overlays/group";
import { cn } from "../../lib/utils.ts";
import { PatternDetails } from "./PatternLegend.tsx";

interface ExpiredSection {
  /** Expired analyses loaded so far, all timeframes. */
  patterns: PatternOverlay[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  unavailable: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

interface PatternsPanelProps {
  symbol: string;
  /** Every currently valid pattern for the symbol, across all timeframes. */
  patterns: PatternOverlay[];
  /** Timeframe whose group is listed first. */
  leadingTimeframe: string | null;
  hiddenIds: ReadonlySet<string>;
  loading: boolean;
  /** The analysis backend could not be reached. */
  unavailable: boolean;
  onToggle: (id: string) => void;
  expired: ExpiredSection;
}

/** "in 7h" / "3h ago" relative to now. */
function relativeTime(iso: string): string {
  const mins = Math.round((Date.parse(iso) - Date.now()) / 60_000);
  const abs = Math.abs(mins);
  const span = abs < 60 ? `${abs}m` : abs < 48 * 60 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`;
  return mins > 0 ? `in ${span}` : `${span} ago`;
}

/**
 * Right-panel list of everything the trading backend detected for the symbol,
 * grouped by timeframe, the one being looked at first. A row expands to the
 * same details as the chart popup. Expired analyses sit in a collapsed
 * section at the bottom, loaded page by page when opened.
 */
export function PatternsPanel({
  symbol,
  patterns,
  leadingTimeframe,
  hiddenIds,
  loading,
  unavailable,
  onToggle,
  expired,
}: PatternsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Collapsed timeframe groups, keyed "live:1d" / "expired:4h" so the two
  // lists collapse independently.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const rowProps = {
    hiddenIds,
    expanded,
    onExpand: setExpanded,
    onToggle,
  };

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
          groupByTimeframe(patterns, leadingTimeframe).map((group) => (
            <GroupSection
              key={group.timeframe}
              group={group}
              collapsed={collapsed.has(`live:${group.timeframe}`)}
              onCollapse={() => toggleGroup(`live:${group.timeframe}`)}
              {...rowProps}
            />
          ))
        )}

        {!unavailable && (
          <section className="border-t border-border mt-2">
            <button
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => expired.onOpenChange(!expired.open)}
            >
              {expired.open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Expired
              {expired.patterns.length > 0 && (
                <span className="font-normal normal-case tracking-normal">
                  ({expired.patterns.length}
                  {expired.hasMore ? "+" : ""})
                </span>
              )}
            </button>

            {expired.open &&
              (expired.loading ? (
                <p className="px-3 pb-3 text-xs text-muted-foreground">Loading history…</p>
              ) : expired.unavailable ? (
                <p className="px-3 pb-3 text-xs text-muted-foreground">History is not reachable right now.</p>
              ) : expired.patterns.length === 0 && !expired.hasMore ? (
                <p className="px-3 pb-3 text-xs text-muted-foreground">No expired analyses.</p>
              ) : (
                <div className="opacity-90">
                  <p className="px-3 pb-1.5 text-[10px] text-muted-foreground">
                    Hidden on the chart by default; use the eye to show one.
                  </p>
                  {groupByTimeframe(expired.patterns, leadingTimeframe).map((group) => (
                    <GroupSection
                      key={group.timeframe}
                      group={group}
                      collapsed={collapsed.has(`expired:${group.timeframe}`)}
                      onCollapse={() => toggleGroup(`expired:${group.timeframe}`)}
                      {...rowProps}
                    />
                  ))}
                  {expired.hasMore && (
                    <button
                      className="w-full py-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                      onClick={expired.onLoadMore}
                      disabled={expired.loadingMore}
                    >
                      {expired.loadingMore ? "Loading…" : "Load more"}
                    </button>
                  )}
                </div>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  hiddenIds: ReadonlySet<string>;
  expanded: string | null;
  onExpand: (id: string | null) => void;
  onToggle: (id: string) => void;
}

interface GroupProps extends RowProps {
  group: TimeframeGroup;
  collapsed: boolean;
  onCollapse: () => void;
}

/** One timeframe's header (click to collapse) and its pattern rows. */
function GroupSection({ group, collapsed, onCollapse, ...row }: GroupProps) {
  return (
    <section className="border-b border-border">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 bg-card sticky top-0 z-10 text-left hover:bg-accent/40"
        onClick={onCollapse}
        aria-expanded={!collapsed}
        title={collapsed ? `Show ${group.timeframe} patterns` : `Collapse ${group.timeframe} patterns`}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{group.timeframe}</span>
        <span className="text-[10px] text-muted-foreground">({group.patterns.length})</span>
      </button>
      {!collapsed &&
        group.patterns.map((pattern) => <PatternRow key={pattern.id} pattern={pattern} {...row} />)}
    </section>
  );
}

/** A pattern's summary line; expands to its full details. */
function PatternRow({ pattern, hiddenIds, expanded, onExpand, onToggle }: RowProps & { pattern: PatternOverlay }) {
  const hidden = hiddenIds.has(pattern.id);
  const open = expanded === pattern.id;
  return (
    <div className={cn("px-3", hidden && "opacity-50")}>
      <div className="flex items-center gap-1.5 py-1.5 cursor-pointer" onClick={() => onExpand(open ? null : pattern.id)}>
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">{pattern.name}</div>
          <div className="text-[10px] text-muted-foreground truncate">
            {pattern.direction && (
              <span className={directionClass(pattern.direction)}>{capitalize(pattern.direction)}</span>
            )}
            {pattern.confidence != null && <> · {percent(pattern.confidence)}</>}
            {pattern.patternState && <> · {humanize(pattern.patternState)}</>}
            <>
              {" "}
              · {pattern.expired ? "expired" : "expires"} {relativeTime(pattern.expiresAt)}
            </>
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
            <div className="mb-1.5 text-[10px] font-mono text-muted-foreground">{pattern.patternType}</div>
          )}
          <PatternDetails pattern={pattern} />
        </div>
      )}
    </div>
  );
}
