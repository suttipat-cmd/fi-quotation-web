import { afterEach, describe, expect, it, vi } from "vitest";
import { plusDays, today } from "./format";

describe("local calendar dates", () => {
  afterEach(() => vi.useRealTimers());

  it("uses the local day and preserves it when adding days across a month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 30, 0, 15));
    expect(today()).toBe("2026-11-30");
    expect(plusDays(30)).toBe("2026-12-30");
  });
});
