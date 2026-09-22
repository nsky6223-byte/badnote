// 스트로크 데이터 모델 + 렌더링. 데이터는 항상 포인트 배열(벡터)로 보관한다 —
// 나중에 글리치 효과가 픽셀이 아니라 이 데이터를 조작해야 하기 때문이다.
//
// perfect-freehand로 포인트 배열 -> 필압 반응형 외곽선(polygon)을 만들고 채워 그린다.
// 펜 종류(만년필/볼펜/화필)는 perfect-freehand 옵션 프리셋으로 "느낌"을 다르게 낸다.

import { getStroke } from "perfect-freehand";
import type { NormalizedPoint, PointerKind } from "./pointerInput";

export type Point = NormalizedPoint;

export type PenType = "fountain" | "ballpoint" | "brush";
export type StrokeKind = "pen" | "highlighter";
export type ToolKind = "pen" | "highlighter" | "eraser";
export type EraserMode = "stroke" | "normal";
export type EraserSizeLevel = "sm" | "md" | "lg";

export const ERASER_RADIUS: Record<EraserSizeLevel, number> = {
  sm: 10,
  md: 20,
  lg: 36,
};

export type Stroke = {
  id: string;
  kind: StrokeKind;
  penType?: PenType;
  color: string;
  size: number;
  sharpness: number; // 0~100, kind === "pen"에서만 사용. 펜 끝을 얼마나 뾰족하게 마무리할지.
  opacity: number; // 1 = 불투명, 형광펜은 반투명
  pointerKind: PointerKind;
  points: Point[];
};

export function createStroke(
  kind: StrokeKind,
  penType: PenType | undefined,
  color: string,
  size: number,
  sharpness: number,
  opacity: number,
  pointerKind: PointerKind,
): Stroke {
  return {
    id: crypto.randomUUID(),
    kind,
    penType,
    color,
    size,
    sharpness,
    opacity,
    pointerKind,
    points: [],
  };
}

type PenPreset = {
  thinning: number;
  smoothing: number;
  streamline: number;
  startTaper: number;
  endTaper: number;
  cap: boolean;
};

// 펜 종류별 perfect-freehand 프리셋. 실제 필기구 느낌을 근사한 값이며 미세 조정 가능.
const PEN_PRESETS: Record<PenType, PenPreset> = {
  ballpoint: { thinning: 0.15, smoothing: 0.4, streamline: 0.3, startTaper: 0, endTaper: 0, cap: true },
  fountain: { thinning: 0.65, smoothing: 0.5, streamline: 0.5, startTaper: 6, endTaper: 14, cap: false },
  brush: { thinning: 0.85, smoothing: 0.6, streamline: 0.4, startTaper: 16, endTaper: 24, cap: false },
};

const HIGHLIGHTER_PRESET: PenPreset = {
  thinning: 0,
  smoothing: 0.3,
  streamline: 0.3,
  startTaper: 0,
  endTaper: 0,
  cap: true,
};

function getPreset(stroke: Stroke): PenPreset {
  if (stroke.kind === "highlighter") return HIGHLIGHTER_PRESET;
  return PEN_PRESETS[stroke.penType ?? "ballpoint"];
}

function strokeToOutline(stroke: Stroke): number[][] {
  const preset = getPreset(stroke);
  // 선명도(sharpness)가 낮을수록 펜 끝에 여분의 taper를 더해 뭉툭/부드럽게 만든다.
  const softness = stroke.kind === "pen" ? (100 - stroke.sharpness) / 100 : 0;
  const taperExtra = softness * stroke.size * 2.5;

  return getStroke(
    stroke.points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: stroke.size,
      thinning: preset.thinning,
      smoothing: preset.smoothing,
      streamline: preset.streamline,
      // 마우스는 실제 필압이 없으므로 속도 기반으로 필압을 흉내낸다.
      simulatePressure: stroke.pointerKind !== "pen",
      start: { taper: preset.startTaper + taperExtra, cap: preset.cap },
      end: { taper: preset.endTaper + taperExtra, cap: preset.cap },
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

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = stroke.opacity;
  ctx.fillStyle = stroke.color;
  ctx.fill(outlineToPath2D(outline));
  ctx.globalAlpha = prevAlpha;
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

// 획 지우개: 반경 안에 포인트가 하나라도 있으면 스트로크 전체를 삭제한다.
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

// 일반 지우개: 반경 안에 들어온 포인트만 제거하고, 남은 점들을 연속 구간별로 나눠
// 여러 개의 새 스트로크로 되돌린다 (부분 삭제).
export function erasePartial(
  strokes: Stroke[],
  x: number,
  y: number,
  radius: number,
): { strokes: Stroke[]; changed: boolean } {
  const r2 = radius * radius;
  const result: Stroke[] = [];
  let changed = false;

  for (const stroke of strokes) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    // 지우개 반경이 스트로크의 바운딩 박스에 닿지 않으면 그대로 통과 (빠른 스킵).
    if (x + radius < minX || x - radius > maxX || y + radius < minY || y - radius > maxY) {
      result.push(stroke);
      continue;
    }

    let hasHit = false;
    for (const p of stroke.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= r2) {
        hasHit = true;
        break;
      }
    }
    if (!hasHit) {
      result.push(stroke);
      continue;
    }

    changed = true;
    let run: Point[] = [];
    for (const p of stroke.points) {
      const dx = p.x - x;
      const dy = p.y - y;
      const hit = dx * dx + dy * dy <= r2;
      if (hit) {
        if (run.length >= 2) result.push({ ...stroke, id: crypto.randomUUID(), points: run });
        run = [];
      } else {
        run.push(p);
      }
    }
    if (run.length >= 2) result.push({ ...stroke, id: crypto.randomUUID(), points: run });
  }

  return { strokes: result, changed };
}
