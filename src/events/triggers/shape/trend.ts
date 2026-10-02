// 추세선(차트) 인식: 포인트 y값의 선형 회귀 기울기 + 꺾임 수로 상승/하락 차트를
// 구분한다 (EVENTS_SPEC.md 3-1장, 예: 우하향 지그재그 → 떡락 주식짤).
//
// ShapeDetector 타입은 (strokes) => number 하나만 받으므로 "어느 방향인지"를 함께
// 돌려줄 수 없다. 그래서 감지기 자체를 팩토리로 두고, "상승 감지기"/"하락 감지기"를
// 각각 별도 ShapeDetector로 만들어 쓴다 — stonks 밈처럼 방향별로 다른 이벤트를 등록해야
// 하는 경우를 그대로 지원한다.

import type { Point, Stroke } from "../../../canvas/engine/strokeEngine";

export type TrendDirection = "up" | "down";

function linearRegressionSlope(points: readonly Point[]): number {
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (const p of points) {
    numerator += (p.x - meanX) * (p.y - meanY);
    denominator += (p.x - meanX) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

// 전체적으로 x가 증가하는 동안 y가 오르내리며 방향이 바뀐 횟수(지그재그 정도).
// 손으로 그린 차트는 보통 x는 꾸준히 증가하고 y만 위아래로 꺾이므로 y 방향을 본다.
function countTurns(points: readonly Point[]): number {
  if (points.length < 3) return 0;
  let turns = 0;
  let prevDir = Math.sign(points[1].y - points[0].y);
  for (let i = 2; i < points.length; i++) {
    const dir = Math.sign(points[i].y - points[i - 1].y);
    if (dir !== 0 && dir !== prevDir && prevDir !== 0) turns++;
    if (dir !== 0) prevDir = dir;
  }
  return turns;
}

export function createTrendDetector(direction: TrendDirection): (strokes: readonly Stroke[]) => number {
  return (strokes) => {
    const points = strokes.flatMap((s) => s.points);
    if (points.length < 4) return 0;

    const slope = linearRegressionSlope(points);
    // 캔버스 좌표는 아래로 갈수록 y가 커지므로, "상승"은 x가 커질 때 y가 작아지는
    // 음의 기울기다.
    const directional = direction === "up" ? -slope : slope;
    if (directional <= 0) return 0;

    const slopeConfidence = Math.min(1, Math.abs(directional) / 2);
    // 완전한 직선보다는 지그재그가 섞여야 "차트"답다 — 꺾임이 전혀 없으면 살짝 감점.
    const turnBonus = countTurns(points) >= 1 ? 1 : 0.6;

    return Math.min(1, slopeConfidence * turnBonus);
  };
}

export const detectUptrend = createTrendDetector("up");
export const detectDowntrend = createTrendDetector("down");
