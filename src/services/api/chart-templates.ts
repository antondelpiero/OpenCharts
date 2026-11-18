import { safeStorage } from "../../lib/safe-storage.ts";
// Chart templates persist to localStorage in demo mode (no backend).

/** An indicator instance as persisted in a template (ids are re-minted on load). */
export interface StoredIndicatorInstance {
  type: string;
  params: Record<string, number>;
  color?: string;
}

export interface ChartTemplateContent {
  version: 1;
  /** Snapshot of the TEMPLATE_PREF_KEYS subset of ChartPreferences. */
  prefs: Record<string, string | boolean>;
  /**
   * v1 templates stored bare type names (`["EMA","RSI"]`). Indicators are now
   * configurable instances, so new templates store those objects instead; both
   * forms are accepted here and normalised on load (see ChartTemplatesMenu).
   */
  indicators: Array<string | StoredIndicatorInstance>;
  plugins: string[];
}

export interface ChartTemplate {
  id: string;
  name: string;
  layoutType: string;
  isDefault: boolean;
  panels: ChartTemplateContent[];
  updatedAt: string;
}

const KEY = "oc_chart_templates";

function readAll(): ChartTemplate[] {
  try {
    return JSON.parse(safeStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeAll(list: ChartTemplate[]): void {
  safeStorage.setItem(KEY, JSON.stringify(list));
}

export const chartTemplatesApi = {
  list: () => Promise.resolve(readAll()),

  /** Upserts by name (unique per user). */
  save: (name: string, content: ChartTemplateContent, isDefault = false) => {
    const list = readAll().filter((t) => t.name !== name);
    const template: ChartTemplate = {
      id: crypto.randomUUID(),
      name,
      layoutType: "SINGLE",
      isDefault,
      panels: [content],
      updatedAt: new Date().toISOString(),
    };
    list.push(template);
    writeAll(list);
    return Promise.resolve(template);
  },

  remove: (id: string) => {
    writeAll(readAll().filter((t) => t.id !== id));
    return Promise.resolve({ deleted: true });
  },
};
