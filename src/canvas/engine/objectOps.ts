// 스트로크/도형/이미지/텍스트/스티커를 하나의 "오브젝트"로 다루기 위한 공통 연산.
// 올가미 선택, 이동, 크기조정, 복제, 색상변경, 지우개 히트테스트가 모든 타입에
// 동일한 방식으로 적용된다. 스트로크만 점 구름이고 나머지는 전부 바운딩 박스
// (x,y,width,height) 기반이라, 박스 타입들은 대부분 한 분기로 같이 처리한다.

import { renderImage, type ImageObject } from "./imageEngine";
import { renderOverrides } from "./renderPipeline";
import { renderShape, type Pt, type ShapeObject } from "./shapeEngine";
import { renderSticker, type StickerObject } from "./stickerEngine";
import { renderStroke, type Stroke } from "./strokeEngine";
import { renderText, type TextObject } from "./textEngine";

export type CanvasObject = Stroke | ShapeObject | ImageObject | TextObject | StickerObject;

export type Bounds = { x: number; y: number; width: number; height: number };

export function getBounds(obj: CanvasObject): Bounds {
  if (obj.objectType !== "stroke") {
    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of obj.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function unionBounds(list: Bounds[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of list) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pointInBounds(x: number, y: number, b: Bounds): boolean {
  return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
}

export function translateObject(obj: CanvasObject, dx: number, dy: number): CanvasObject {
  if (obj.objectType === "stroke") {
    return { ...obj, points: obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
  }
  return { ...obj, x: obj.x + dx, y: obj.y + dy };
}

// scaleX/scaleY만큼 (pivotX, pivotY)를 기준으로 확대/축소한다.
export function scaleObject(
  obj: CanvasObject,
  scaleX: number,
  scaleY: number,
  pivotX: number,
  pivotY: number,
): CanvasObject {
  if (obj.objectType === "stroke") {
    const avgScale = (scaleX + scaleY) / 2;
    return {
      ...obj,
      size: Math.max(0.5, obj.size * avgScale),
      points: obj.points.map((p) => ({
        ...p,
        x: pivotX + (p.x - pivotX) * scaleX,
        y: pivotY + (p.y - pivotY) * scaleY,
      })),
    };
  }

  const x = pivotX + (obj.x - pivotX) * scaleX;
  const y = pivotY + (obj.y - pivotY) * scaleY;
  const width = obj.width * scaleX;
  const height = obj.height * scaleY;

  if (obj.objectType === "shape") {
    return { ...obj, x, y, width, height, strokeWidth: Math.max(0.5, obj.strokeWidth * ((scaleX + scaleY) / 2)) };
  }
  if (obj.objectType === "text") {
    return { ...obj, x, y, width, height, fontSize: Math.max(4, obj.fontSize * ((scaleX + scaleY) / 2)) };
  }
  return { ...obj, x, y, width, height }; // image, sticker
}

// 이미지/스티커는 "색상" 개념이 없는 고정 디자인이라 대상에서 제외한다.
export function recolorObject(obj: CanvasObject, color: string): CanvasObject {
  if (obj.objectType === "image" || obj.objectType === "sticker") return obj;
  return { ...obj, color };
}

export function duplicateObject(obj: CanvasObject, dx = 20, dy = 20): CanvasObject {
  const moved = translateObject(obj, dx, dy);
  return { ...moved, id: crypto.randomUUID() };
}

export function pointInPolygon(x: number, y: number, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// 올가미로 감싼 영역에 오브젝트가 들어왔는지 판정한다.
// 스트로크는 점의 절반 이상이 폴리곤 안에 있으면, 박스 타입들은 중심점 기준으로 판정한다.
export function objectIntersectsLasso(obj: CanvasObject, polygon: Pt[]): boolean {
  if (obj.objectType !== "stroke") {
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    return pointInPolygon(cx, cy, polygon);
  }
  if (obj.points.length === 0) return false;
  let inCount = 0;
  for (const p of obj.points) {
    if (pointInPolygon(p.x, p.y, polygon)) inCount++;
  }
  return inCount / obj.points.length >= 0.5;
}

export function renderObject(ctx: CanvasRenderingContext2D, obj: CanvasObject) {
  // render 글리치가 걸려 있으면(EVENTS_SPEC.md 2-1장) 데이터는 그대로 두고 그리는
  // 방식만 일시적으로 바꾼다. 평소엔 오버라이드가 없어 그냥 통과한다.
  const override = renderOverrides.get(obj.id);
  if (override) {
    ctx.save();
    if (override.filter) ctx.filter = override.filter;
    if (override.globalAlpha !== undefined) ctx.globalAlpha = override.globalAlpha;
  }

  switch (obj.objectType) {
    case "shape":
      renderShape(ctx, obj);
      break;
    case "image":
      renderImage(ctx, obj);
      break;
    case "text":
      renderText(ctx, obj);
      break;
    case "sticker":
      renderSticker(ctx, obj);
      break;
    default:
      renderStroke(ctx, obj);
  }

  if (override) ctx.restore();
}

export function redrawObjects(
  ctx: CanvasRenderingContext2D,
  objects: CanvasObject[],
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  for (const obj of objects) renderObject(ctx, obj);
}

// 지우개 히트테스트. 스트로크는 점 하나라도 반경 안에 있으면, 박스 타입들은
// 바운딩 박스까지의 최단거리로 판정한다 (박스 안이면 거리 0).
export function hitTestObject(obj: CanvasObject, x: number, y: number, radius: number): boolean {
  if (obj.objectType !== "stroke") {
    const cx = Math.max(obj.x, Math.min(x, obj.x + obj.width));
    const cy = Math.max(obj.y, Math.min(y, obj.y + obj.height));
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  }
  for (const p of obj.points) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}
