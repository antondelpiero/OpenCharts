/** Display formatting shared by the pattern legend, popup and panel. */

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
/** "AT_LEVEL" → "At level" */
export const humanize = (s: string) => capitalize(s.replace(/_/g, " "));
export const percent = (c: number) => `${Math.round(c * 100)}%`;

export function formatPrice(p: number): string {
  const digits = Math.abs(p) >= 100 ? 2 : Math.abs(p) >= 1 ? 4 : 6;
  return p.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function directionClass(direction: string | null): string {
  if (direction === "bullish") return "text-buy";
  if (direction === "bearish") return "text-sell";
  return "text-muted-foreground";
}
