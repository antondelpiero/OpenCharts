import { describe, expect, it } from "vitest";
import { msUntilBarClose } from "../lib/barClose";

const sec = (iso: string) => Date.parse(iso) / 1000;

describe("msUntilBarClose", () => {
  it("waits until the current 15m bar closes, plus settle time", () => {
    const open = sec("2026-11-17T10:15:00Z");
    const now = Date.parse("2026-11-17T10:20:00Z");
    expect(msUntilBarClose(open, "15m", now)).toBe(10 * 60_000 + 3_000);
  });

  it("lands on 00:00 UTC for daily bars", () => {
    const open = sec("2026-11-17T00:00:00Z");
    const now = Date.parse("2026-11-17T23:00:00Z");
    expect(msUntilBarClose(open, "1d", now)).toBe(60 * 60_000 + 3_000);
  });

  it("follows the bar's own open time for weekly bars (Monday 00:00 UTC)", () => {
    const open = sec("2026-11-16T00:00:00Z"); // a Monday
    const now = Date.parse("2026-11-22T23:59:00Z");
    expect(msUntilBarClose(open, "1w", now)).toBe(60_000 + 3_000);
  });

  it("retries soon when the newest bar is already past its close", () => {
    const open = sec("2026-11-17T09:00:00Z");
    const now = Date.parse("2026-11-17T11:00:00Z");
    expect(msUntilBarClose(open, "1h", now)).toBe(15_000);
  });
});
