// Pointer Events 정규화: mouse/touch/pen을 하나의 Point 형태로 변환한다.

export type PointerKind = "pen" | "touch" | "mouse";

export type NormalizedPoint = {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
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

  return {
    x,
    y,
    pressure,
    tiltX: e.tiltX ?? 0,
    tiltY: e.tiltY ?? 0,
    t: e.timeStamp,
  };
}
