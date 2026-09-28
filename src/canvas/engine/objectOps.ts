// 스트로크와 도형을 하나의 "오브젝트"로 다루기 위한 공통 연산.
// 올가미 선택, 이동, 크기조정, 복제, 색상변경이 스트로크/도형에 동일한 방식으로 적용된다.

import { renderShape, hitTestShape, type Pt, type ShapeObject } from "./shapeEngine";
import { renderStroke, type Stroke } from "./strokeEngine";

export type CanvasObject = Stroke | ShapeObject;

export type Bounds = { x: number; y: number; width: number; height: number };

export function getBounds(obj: CanvasObject): Bounds {
  if (obj.objectType === "shape") {
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
  if (obj.objectType === "shape") {
    return { ...obj, x: obj.x + dx, y: obj.y + dy };
  }
  return { ...obj, points: obj.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) };
}

// scaleX/scaleY만큼 (pivotX, pivotY)를 기준으로 확대/축소한다.
export function scaleObject(
  obj: CanvasObject,
  scaleX: number,
  scaleY: number,
  pivotX: number,
  pivotY: number,
): CanvasObject {
  if (obj.objectType === "shape") {
    return {
      ...obj,
      x: pivotX + (obj.x - pivotX) * scaleX,
      y: pivotY + (obj.y - pivotY) * scaleY,
      width: obj.width * scaleX,
      height: obj.height * scaleY,
      strokeWidth: Math.max(0.5, obj.strokeWidth * ((scaleX + scaleY) / 2)),
    };
  }
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

export function recolorObject(obj: CanvasObject, color: string): CanvasObject {
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
// 스트로크는 점의 절반 이상이 폴리곤 안에 있으면, 도형은 중심점 기준으로 판정한다.
export function objectIntersectsLasso(obj: CanvasObject, polygon: Pt[]): boolean {
  if (obj.objectType === "shape") {
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
  if (obj.objectType === "shape") renderShape(ctx, obj);
  else renderStroke(ctx, obj);
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

export function hitTestObject(obj: CanvasObject, x: number, y: number, radius: number): boolean {
  if (obj.objectType === "shape") return hitTestShape(obj, x, y, radius);
  for (const p of obj.points) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy <= radius * radius) return true;
  }
  return false;
}
