import { describe, expect, it } from "vitest";
import { currentMonthKey, monthBounds, previousMonthKeys } from "@/lib/date";

describe("date helpers", () => {
  it("creates month key and boundaries", () => {
    const key = currentMonthKey(new Date("2026-02-14T00:00:00.000Z"));
    expect(key).toBe("2026-02");

    const bounds = monthBounds("2026-02");
    expect(bounds.start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns previous month keys", () => {
    const keys = previousMonthKeys("2026-02", 3);
    expect(keys).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});
