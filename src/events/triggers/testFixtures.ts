// 트리거/감지기 테스트에서 쓰는 최소한의 가짜 Stroke 생성기.
// 실제 엔진의 createStroke()는 crypto.randomUUID() 등 브라우저 API에 의존하지 않지만,
// 테스트에서는 좌표만 필요하므로 그보다 더 가벼운 버전을 둔다.

import type { Point, Stroke } from "../../canvas/engine/strokeEngine";

export function fakePoint(x: number, y: number): Point {
  return { x, y, pressure: 0.5, tiltX: 0, tiltY: 0, t: 0 };
}

export function fakeStroke(points: Array<[number, number]>): Stroke {
  return {
    id: `test-${Math.random()}`,
    objectType: "stroke",
    kind: "pen",
    color: "#000",
    size: 2,
    sharpness: 50,
    opacity: 1,
    pointerKind: "mouse",
    points: points.map(([x, y]) => fakePoint(x, y)),
  };
}

// (x,y)에서 시작해 각도(도)/길이로 끝점까지 steps개의 점으로 잇는 "거의 직선"인 스트로크.
export function straightStroke(
  x: number,
  y: number,
  angleDeg: number,
  length: number,
  steps = 10,
): Stroke {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * length;
  const dy = Math.sin(rad) * length;
  const points: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push([x + dx * t, y + dy * t]);
  }
  return fakeStroke(points);
}
