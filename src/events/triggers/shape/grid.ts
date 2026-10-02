// 격자 인식: 가로/세로로 곧은 스트로크가 여러 개 교차하면 "격자"로 본다
// (EVENTS_SPEC.md 3-1장, 예: 격자를 그리면 오목판이 뜬다). ML 없는 순수 휴리스틱.

import type { Stroke } from "../../../canvas/engine/strokeEngine";

const MIN_LINE_LENGTH = 10; // 이보다 짧으면 "선"으로 판단하지 않는다.
const STRAIGHTNESS_RATIO = 0.9; // 직선거리/경로길이 비율이 이 이상이면 "곧다"고 본다.
const HORIZONTAL_MAX_ANGLE = 20; // 도. 이하이면 가로선.
const VERTICAL_MIN_ANGLE = 70; // 도. 이상이면 세로선.
const LINES_FOR_FULL_CONFIDENCE = 3; // 가로/세로 각각 이 개수 이상이면 confidence 1.

function isRoughlyStraight(stroke: Stroke): boolean {
  const pts = stroke.points;
  if (pts.length < 2) return false;

  const start = pts[0];
  const end = pts[pts.length - 1];
  const straightDist = Math.hypot(end.x - start.x, end.y - start.y);
  if (straightDist < MIN_LINE_LENGTH) return false;

  let pathLen = 0;
  for (let i = 1; i < pts.length; i++) {
    pathLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  if (pathLen === 0) return false;

  return straightDist / pathLen >= STRAIGHTNESS_RATIO;
}

function orientation(stroke: Stroke): "horizontal" | "vertical" | null {
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  const angle = (Math.atan2(Math.abs(end.y - start.y), Math.abs(end.x - start.x)) * 180) / Math.PI;
  if (angle <= HORIZONTAL_MAX_ANGLE) return "horizontal";
  if (angle >= VERTICAL_MIN_ANGLE) return "vertical";
  return null; // 애매하게 비스듬하면 격자 판정에서 제외한다.
}

export function detectGrid(strokes: readonly Stroke[]): number {
  let horizontal = 0;
  let vertical = 0;

  for (const stroke of strokes) {
    if (!isRoughlyStraight(stroke)) continue;
    const o = orientation(stroke);
    if (o === "horizontal") horizontal++;
    else if (o === "vertical") vertical++;
  }

  if (horizontal < 2 || vertical < 2) return 0;

  const score = Math.min(horizontal, vertical) / LINES_FOR_FULL_CONFIDENCE;
  return Math.min(1, score);
}
