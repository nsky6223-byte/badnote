// 입력 파이프라인: 펜/형광펜으로 그리는 동안 포인트 하나하나가 실제로 스트로크에
// 쌓이기 전 거쳐가는 미들웨어 체인. "input" 글리치(손떨림 증폭, 선 휘어짐 등)가
// 포인트 좌표 자체를 바꿔치기할 수 있는 유일한 통로다 (EVENTS_SPEC.md 2-1장).
//
// hooks.ts가 "무슨 일이 일어났는지 관찰"하는 통로라면, 이 파이프라인은 "실제로 그려지는
// 좌표를 가로채 바꾸는" 통로라 역할이 다르다 — 그래서 별도 파일로 분리했다.
//
// 미들웨어가 하나도 등록되지 않은 평소 상태에서는 포인트를 그대로 통과시키므로,
// 이벤트 시스템이 아직 없어도(또는 비활성화해도) 드로잉 엔진 동작에 전혀 영향이 없다.

import type { Point } from "./strokeEngine";

export type InputMiddlewareContext = {
  toolKind: "pen" | "highlighter";
};

export type InputMiddleware = (point: Point, context: InputMiddlewareContext) => Point;

class InputPipeline {
  private middlewares: InputMiddleware[] = [];

  // 등록 순서대로 적용된다. 반환값으로 구독 해제 함수를 준다.
  use(middleware: InputMiddleware): () => void {
    this.middlewares.push(middleware);
    return () => {
      const i = this.middlewares.indexOf(middleware);
      if (i >= 0) this.middlewares.splice(i, 1);
    };
  }

  process(point: Point, context: InputMiddlewareContext): Point {
    let result = point;
    for (const middleware of this.middlewares) {
      result = middleware(result, context);
    }
    return result;
  }

  clear(): void {
    this.middlewares = [];
  }
}

export const inputPipeline = new InputPipeline();
