import { describe, expect, it } from "vitest";
import { createRng } from "../../core/rng";
import { planCatWalk } from "./logic";

describe("planCatWalk", () => {
  it("같은 시드는 항상 같은 계획을 낸다", () => {
    const a = planCatWalk(createRng(1));
    const b = planCatWalk(createRng(1));
    expect(a).toEqual(b);
  });

  it("durationMs는 항상 3000~4500ms 사이다", () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = planCatWalk(createRng(seed));
      expect(plan.durationMs).toBeGreaterThanOrEqual(3000);
      expect(plan.durationMs).toBeLessThan(4500);
    }
  });
});
