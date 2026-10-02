import { describe, expect, it } from "vitest";
import { fakeStroke } from "../testFixtures";
import { detectDowntrend, detectUptrend } from "./trend";

// 캔버스 좌표는 아래로 갈수록 y가 커진다. "상승" 차트는 x가 커질수록 y가 작아지는
// 지그재그로 흉내낸다.
function zigzag(direction: "up" | "down"): ReturnType<typeof fakeStroke> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) {
    const x = i * 10;
    const base = direction === "up" ? 100 - i * 8 : i * 8;
    const wiggle = i % 2 === 0 ? -5 : 5;
    points.push([x, base + wiggle]);
  }
  return fakeStroke(points);
}

describe("createTrendDetector", () => {
  it("우상향(캔버스에서 y가 감소) 지그재그는 detectUptrend에서 높은 confidence를 낸다", () => {
    const stroke = zigzag("up");
    expect(detectUptrend([stroke])).toBeGreaterThan(0.3);
    expect(detectDowntrend([stroke])).toBe(0);
  });

  it("우하향(캔버스에서 y가 증가) 지그재그는 detectDowntrend에서 높은 confidence를 낸다", () => {
    const stroke = zigzag("down");
    expect(detectDowntrend([stroke])).toBeGreaterThan(0.3);
    expect(detectUptrend([stroke])).toBe(0);
  });

  it("점이 너무 적으면 0을 반환한다", () => {
    const stroke = fakeStroke([
      [0, 0],
      [10, 10],
    ]);
    expect(detectUptrend([stroke])).toBe(0);
    expect(detectDowntrend([stroke])).toBe(0);
  });

  it("수평선(추세 없음)은 양쪽 다 낮은 confidence다", () => {
    const flat = fakeStroke([
      [0, 50],
      [20, 50],
      [40, 50],
      [60, 50],
      [80, 50],
    ]);
    expect(detectUptrend([flat])).toBe(0);
    expect(detectDowntrend([flat])).toBe(0);
  });
});
