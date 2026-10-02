// 닫힌 도형 인식: 시작점-끝점 거리가 스트로크 크기(바운딩박스 대각선) 대비 작으면
// "닫혔다"고 본다 (EVENTS_SPEC.md 3-1장). ML 없는 순수 휴리스틱.

import type { Stroke } from "../../../canvas/engine/strokeEngine";

// 대각선 대비 시작-끝 거리 비율이 이 값 이하면 confidence 1에 가깝다.
const CLOSE_RATIO_THRESHOLD = 0.35;

export function detectClosedLoop(strokes: readonly Stroke[]): number {
  const points = strokes.flatMap((s) => s.points);
  if (points.length < 3) return 0;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  if (diagonal === 0) return 0;

  const start = points[0];
  const end = points[points.length - 1];
  const gap = Math.hypot(end.x - start.x, end.y - start.y);
  const ratio = gap / diagonal;

  return Math.max(0, 1 - ratio / CLOSE_RATIO_THRESHOLD);
}
