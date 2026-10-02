// 이벤트 런타임이 실제 엔진(DrawingCanvas)을 조작할 때 쓰는 좁은 인터페이스.
// "이벤트는 엔진 내부 상태를 직접 import/수정하지 않는다"는 원칙을 지키기 위해,
// DrawingCanvas가 이 인터페이스의 실제 구현체를 런타임에 등록해준다.

import type { CanvasObject } from "../../canvas/engine/objectOps";

export type EngineAdapter = {
  getObjects(): readonly CanvasObject[];
  addObjects(objects: CanvasObject[]): void;
  updateObject(id: string, patch: Partial<CanvasObject>): void;
  pauseInput(): void;
  resumeInput(): void;
  requestRedraw(): void;
};
