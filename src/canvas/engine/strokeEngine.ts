// 스트로크 데이터 모델 + 렌더링. 데이터는 항상 포인트 배열(벡터)로 보관한다 —
// 나중에 글리치 효과가 픽셀이 아니라 이 데이터를 조작해야 하기 때문이다.
//
// 1주차 범위: perfect-freehand 없이 raw point를 직선으로 이어 그린다.
// perfect-freehand 연동은 2주차에 renderStroke/renderStrokeSegment 내부만 교체하면 된다.

import type { NormalizedPoint } from "./pointerInput";

export type Point = NormalizedPoint;

export type Tool = "pen" | "eraser";

export type Stroke = {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  points: Point[];
};

export function createStroke(tool: Tool, color: string, size: number): Stroke {
  return {
    id: crypto.randomUUID(),
    tool,
    color,
    size,
    points: [],
  };
}

function applyStrokeStyle(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

// pointermove마다 마지막 두 점만 이어 그린다 (증분 렌더링).
export function renderStrokeSegment(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  from: Point,
  to: Point,
) {
  applyStrokeStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

// 스트로크 전체를 처음부터 다시 그린다 (resize/undo 시 전체 redraw용).
export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;
  applyStrokeStyle(ctx, stroke);
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
}

export function redrawAll(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke);
  }
}
