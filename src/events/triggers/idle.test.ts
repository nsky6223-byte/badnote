import { describe, expect, it } from "vitest";
import { IdleTracker } from "./idle";

describe("IdleTracker", () => {
  it("경과 시간이 ms 이상이면 idle로 판정한다", () => {
    const tracker = new IdleTracker(0);
    const rule = { kind: "idle" as const, ms: 10000 };

    expect(tracker.isIdle(rule, 9999)).toBe(false);
    expect(tracker.isIdle(rule, 10000)).toBe(true);
  });

  it("recordActivity 이후에는 그 시점부터 다시 센다", () => {
    const tracker = new IdleTracker(0);
    const rule = { kind: "idle" as const, ms: 10000 };

    tracker.recordActivity(5000);
    expect(tracker.isIdle(rule, 5000 + 9999)).toBe(false);
    expect(tracker.isIdle(rule, 5000 + 10000)).toBe(true);
  });
});
