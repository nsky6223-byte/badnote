// 스트로크 데이터 모델 + 렌더링. 데이터는 항상 포인트 배열(벡터)로 보관한다 —
// 나중에 글리치 효과가 픽셀이 아니라 이 데이터를 조작해야 하기 때문이다.
//
// perfect-freehand로 포인트 배열 -> 필압 반응형 외곽선(polygon)을 만들고 채워 그린다.

import { getStroke } from "perfect-freehand";
import type { NormalizedPoint, PointerKind } from "./pointerInput";

export type Point = NormalizedPoint;

export type Tool = "pen" | "eraser";

export type Stroke = {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  pointerKind: PointerKind;
  points: Point[];
};

export function createStroke(
  tool: Tool,
  color: string,
  size: number,
  pointerKind: PointerKind,
): Stroke {
  return {
    id: crypto.randomUUID(),
    tool,
    color,
    size,
    pointerKind,
    points: [],
  };
}

function strokeToOutline(stroke: Stroke): number[][] {
  return getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: stroke.size,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
      // 마우스는 실제 필압이 없으므로 속도 기반으로 필압을 흉내낸다.
      simulatePressure: stroke.pointerKind !== "pen",
    },
  );
}

function outlineToPath2D(outline: number[][]): Path2D {
  const path = new Path2D();
  if (outline.length === 0) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  const outline = strokeToOutline(stroke);
  if (outline.length < 3) return;
  ctx.fillStyle = stroke.color;
  ctx.fill(outlineToPath2D(outline));
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

// 오브젝트 단위 지우개: 지우개 반경 안에 포인트가 하나라도 있으면 스트로크 전체를 삭제 대상으로 본다.
export function hitTestStroke(
  stroke: Stroke,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (const p of stroke.points) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}
