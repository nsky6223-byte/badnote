// 도형 도구: 손으로 대충 그린 닫힌 도형을 분석해 동그라미/네모/세모/별 중 가장 비슷한
// 형태로 자동 완성한다. 별도의 그리기 UI 없이 "무엇을 그렸는지"를 인식하는 방식이다.
//
// 인식 원리: 그려진 경로를 둘레 길이 기준으로 균등 재샘플링한 뒤, 각 지점에서의
// 방향 전환각(turning angle)이 임계값을 넘는 "코너"를 센다. 코너 개수로 도형을 구분한다
// (삼각형=3, 사각형=4, 별=8~12, 그 외=원).

export type Pt = { x: number; y: number };

export type ShapeKind = "circle" | "rectangle" | "triangle" | "star";

export type ShapeObject = {
  id: string;
  objectType: "shape";
  shapeKind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth: number;
};

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function boundsFromPoints(points: Pt[]): { x: number; y: number; width: number; height: number } {
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
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// 닫힌 경로를 둘레 길이 기준 균등 간격으로 재샘플링 — 손 움직임 속도에 따른
// 점 밀도 차이를 없애 코너 검출을 안정적으로 만든다.
function resampleClosed(points: Pt[], count: number): Pt[] {
  const pts = [...points, points[0]];
  const lengths: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + dist(pts[i - 1], pts[i]));
  }
  const total = lengths[lengths.length - 1];
  if (total === 0) return points;

  const result: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const target = (total * i) / count;
    let seg = 0;
    while (seg < lengths.length - 2 && lengths[seg + 1] < target) seg++;
    const a = pts[seg];
    const b = pts[seg + 1] ?? pts[seg];
    const segLen = lengths[seg + 1] - lengths[seg] || 1;
    const t = (target - lengths[seg]) / segLen;
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

function turningAngle(a: Pt, b: Pt, c: Pt): number {
  const v1 = { x: b.x - a.x, y: b.y - a.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  return Math.atan2(cross, dot);
}

function countCorners(points: Pt[]): number {
  const n = points.length;
  const window = Math.max(2, Math.round(n * 0.06));
  const turning: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i - window + n) % n];
    const b = points[i];
    const c = points[(i + window) % n];
    turning.push(Math.abs(turningAngle(a, b, c)));
  }

  const threshold = (25 * Math.PI) / 180;
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) {
    if (turning[i] < threshold) continue;
    const prev = turning[(i - 1 + n) % n];
    const next = turning[(i + 1) % n];
    if (turning[i] >= prev && turning[i] >= next) candidates.push(i);
  }

  // 서로 너무 가까운 후보(경로 길이의 8% 이내)는 하나의 코너로 합친다.
  const minGap = Math.max(2, Math.round(n * 0.08));
  const merged: number[] = [];
  for (const idx of candidates) {
    if (merged.length === 0 || idx - merged[merged.length - 1] >= minGap) merged.push(idx);
  }
  if (merged.length > 1 && n - merged[merged.length - 1] + merged[0] < minGap) merged.pop();

  return merged.length;
}

// 인식에 실패하면(너무 작거나 닫히지 않음) null을 반환하고, 호출부는 도형 생성을 포기한다.
export function classifyShape(rawPoints: Pt[]): ShapeKind | null {
  if (rawPoints.length < 8) return null;

  const bounds = boundsFromPoints(rawPoints);
  const diag = Math.hypot(bounds.width, bounds.height);
  if (diag < 24) return null;

  const closed = dist(rawPoints[0], rawPoints[rawPoints.length - 1]) < diag * 0.35;
  if (!closed) return null;

  const resampled = resampleClosed(rawPoints, 64);
  const corners = countCorners(resampled);

  if (corners === 3) return "triangle";
  if (corners === 4) return "rectangle";
  if (corners >= 8 && corners <= 12) return "star";
  return "circle";
}

export function createShapeObject(
  shapeKind: ShapeKind,
  bounds: { x: number; y: number; width: number; height: number },
  color: string,
  strokeWidth: number,
): ShapeObject {
  return { id: crypto.randomUUID(), objectType: "shape", shapeKind, ...bounds, color, strokeWidth };
}

function shapePath(shape: ShapeObject): Path2D {
  const { x, y, width, height, shapeKind } = shape;
  const path = new Path2D();

  switch (shapeKind) {
    case "circle": {
      path.ellipse(x + width / 2, y + height / 2, Math.max(width, 1) / 2, Math.max(height, 1) / 2, 0, 0, Math.PI * 2);
      break;
    }
    case "rectangle": {
      path.rect(x, y, width, height);
      break;
    }
    case "triangle": {
      path.moveTo(x + width / 2, y);
      path.lineTo(x + width, y + height);
      path.lineTo(x, y + height);
      path.closePath();
      break;
    }
    case "star": {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const outerR = Math.min(width, height) / 2;
      const innerR = outerR * 0.42;
      let rot = -Math.PI / 2;
      const step = Math.PI / 5;
      path.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      for (let i = 0; i < 5; i++) {
        rot += step;
        path.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
        path.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
      }
      path.closePath();
      break;
    }
  }

  return path;
}

export function renderShape(ctx: CanvasRenderingContext2D, shape: ShapeObject) {
  ctx.lineJoin = "round";
  ctx.lineWidth = shape.strokeWidth;
  ctx.strokeStyle = shape.color;
  ctx.stroke(shapePath(shape));
}

// 지우개: 도형은 점 구름이 아니라 파라미터라 부분 삭제가 불가능하므로,
// 바운딩 박스에 지우개 반경이 닿으면 통째로 지운다.
export function hitTestShape(shape: ShapeObject, x: number, y: number, radius: number): boolean {
  const cx = Math.max(shape.x, Math.min(x, shape.x + shape.width));
  const cy = Math.max(shape.y, Math.min(y, shape.y + shape.height));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}
