import { describe, expect, it } from "vitest";
import { PityCounter } from "./pity";

describe("PityCounter", () => {
  it("afterStrokes만큼 쌓이기 전에는 due가 아니다", () => {
    const counter = new PityCounter();
    const rule = { kind: "pity" as const, afterStrokes: 3 };

    counter.recordStroke();
    counter.recordStroke();
    expect(counter.isDue(rule)).toBe(false);

    counter.recordStroke();
    expect(counter.isDue(rule)).toBe(true);
  });

  it("reset() 이후에는 다시 0부터 센다", () => {
    const counter = new PityCounter();
    const rule = { kind: "pity" as const, afterStrokes: 2 };

    counter.recordStroke();
    counter.recordStroke();
    expect(counter.isDue(rule)).toBe(true);

    counter.reset();
    expect(counter.isDue(rule)).toBe(false);
    expect(counter.strokesSinceReset).toBe(0);
  });
});
