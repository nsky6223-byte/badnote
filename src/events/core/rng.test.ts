// 규칙 6(시드 RNG): 같은 시드는 항상 같은 수열을 내야 버그/이벤트 발동을 재현할 수 있다.

import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("같은 시드는 항상 같은 수열을 낸다", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("다른 시드는 (거의 항상) 다른 수열을 낸다", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it("next()는 항상 [0, 1) 범위다", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n)은 0 이상 n 미만의 정수만 낸다", () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it("pick()은 항상 주어진 배열 안의 값을 고른다", () => {
    const rng = createRng(7);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("chance(1)은 항상 true, chance(0)은 항상 false다", () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i++) {
      expect(rng.chance(1)).toBe(true);
      expect(rng.chance(0)).toBe(false);
    }
  });
});
