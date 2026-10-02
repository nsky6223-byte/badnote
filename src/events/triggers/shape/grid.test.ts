import { describe, expect, it } from "vitest";
import { fakeStroke, straightStroke } from "../testFixtures";
import { detectGrid } from "./grid";

describe("detectGrid", () => {
  it("가로 2개 + 세로 2개가 교차하면 격자로 인식한다", () => {
    const strokes = [
      straightStroke(0, 0, 0, 100), // 가로
      straightStroke(0, 50, 0, 100), // 가로
      straightStroke(0, 0, 90, 100), // 세로
      straightStroke(50, 0, 90, 100), // 세로
    ];
    expect(detectGrid(strokes)).toBeGreaterThan(0);
  });

  it("가로선만 있으면 격자가 아니다 (0)", () => {
    const strokes = [straightStroke(0, 0, 0, 100), straightStroke(0, 50, 0, 100)];
    expect(detectGrid(strokes)).toBe(0);
  });

  it("선이 하나도 곧지 않으면(낙서) 격자가 아니다", () => {
    const scribble = fakeStroke([
      [0, 0],
      [10, 30],
      [5, 10],
      [20, 5],
      [3, 25],
    ]);
    expect(detectGrid([scribble, scribble, scribble, scribble])).toBe(0);
  });

  it("가로/세로 선이 많을수록 confidence가 1에 가까워진다", () => {
    const few = [
      straightStroke(0, 0, 0, 100),
      straightStroke(0, 50, 0, 100),
      straightStroke(0, 0, 90, 100),
      straightStroke(50, 0, 90, 100),
    ];
    const many = [
      straightStroke(0, 0, 0, 100),
      straightStroke(0, 25, 0, 100),
      straightStroke(0, 50, 0, 100),
      straightStroke(0, 0, 90, 100),
      straightStroke(25, 0, 90, 100),
      straightStroke(50, 0, 90, 100),
    ];
    expect(detectGrid(many)).toBeGreaterThanOrEqual(detectGrid(few));
    expect(detectGrid(many)).toBe(1);
  });
});
