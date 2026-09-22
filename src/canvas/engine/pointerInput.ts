// Pointer Events 정규화: mouse/touch/pen을 하나의 Point 형태로 변환한다.
// perfect-freehand 연동(2주차) 전까지는 pressure를 그대로 보관만 하고 사용하지 않는다.

export type NormalizedPoint = {
  x: number;
  y: number;
  pressure: number;
  t: number;
};

export function normalizePointerEvent(
  e: PointerEvent,
  canvas: HTMLCanvasElement,
): NormalizedPoint {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // mouse는 pressure가 항상 0이므로 고정값으로 대체한다.
  const pressure = e.pointerType === "mouse" ? 0.5 : e.pressure || 0.5;

  return { x, y, pressure, t: e.timeStamp };
}
