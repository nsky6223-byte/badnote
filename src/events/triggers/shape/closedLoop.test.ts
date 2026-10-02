import { describe, expect, it } from "vitest";
import { fakeStroke } from "../testFixtures";
import { detectClosedLoop } from "./closedLoop";

describe("detectClosedLoop", () => {
  it("완전히 닫힌 원(시작점 = 끝점)은 confidence가 1에 가깝다", () => {
    const points: Array<[number, number]> = [];
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      points.push([100 + Math.cos(angle) * 50, 100 + Math.sin(angle) * 50]);
    }
    const confidence = detectClosedLoop([fakeStroke(points)]);
    expect(confidence).toBeGreaterThan(0.9);
  });

  it("완전히 열린 직선은 confidence가 0이다", () => {
    const stroke = fakeStroke([
      [0, 0],
      [100, 0],
    ]);
    expect(detectClosedLoop([stroke])).toBe(0);
  });

  it("점이 3개 미만이면 0을 반환한다", () => {
    expect(detectClosedLoop([fakeStroke([[0, 0]])])).toBe(0);
    expect(detectClosedLoop([])).toBe(0);
  });

  it("여러 스트로크에 걸쳐 그린 닫힌 도형도 인식한다", () => {
    const first = fakeStroke([
      [0, 0],
      [100, 0],
      [100, 100],
    ]);
    const second = fakeStroke([
      [100, 100],
      [0, 100],
      [2, 2], // 시작점(0,0) 근처에서 끝남
    ]);
    const confidence = detectClosedLoop([first, second]);
    expect(confidence).toBeGreaterThan(0.8);
  });
});
