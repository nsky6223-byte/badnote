// 엔진 훅: 드로잉 엔진이 "지금 이런 일이 일어났다"고 외부(이벤트 시스템)에 알리는 신호.
// 엔진은 이 파일을 통해서만 신호를 내보내고, 이벤트 시스템이 실제로 존재하는지,
// 무엇을 구독하는지는 전혀 모른다 (EVENTS_SPEC.md 0장).
//
// DOM의 PointerEvent 등과 헷갈리지 않도록 이름 앞에 "엔진 훅"이라는 걸 명확히 한다
// (EVENTS_SPEC.md 1장 용어 규칙).
//
// 원래 스펙 문서는 Stroke[] 단일 모델을 가정해 stroke:commit 하나로 커밋 시점을 표현했지만,
// 실제 엔진은 Stroke/Shape/Image/Text/Sticker를 아우르는 CanvasObject로 확장되어 있다.
// 그래서 "그리기 자체"에 대한 훅(stroke:*)은 펜/형광펜 전용으로 남기고, "무언가 최종
// 확정됨"은 object:commit으로 일반화했다 — 이벤트 쪽에서 어떤 타입이 커밋됐는지는
// payload.object.objectType으로 구분하면 된다.

import type { CanvasObject } from "./objectOps";
import type { Point, Stroke } from "./strokeEngine";
import type { ToolKind } from "./strokeEngine";

export type EngineHooks = {
  // 펜/형광펜 스트로크를 그리기 시작/진행하는 동안에만 발생 (input 글리치가 여기 반응한다).
  "stroke:start": { stroke: Stroke };
  "stroke:point": { point: Point; stroke: Stroke };
  // 어떤 종류든(스트로크/도형/이미지/텍스트/스티커) 오브젝트가 최종적으로 확정될 때.
  "object:commit": { object: CanvasObject; all: readonly CanvasObject[] };
  // 지우개로 무언가 지워졌을 때. 일반 모드는 스트로크를 부분 삭제할 수 있어 "무엇이
  // 지워졌는지"를 정확히 집계하기보다, 지워진 뒤의 전체 상태만 알린다.
  erase: { all: readonly CanvasObject[] };
  "tool:change": { tool: ToolKind };
  "history:undo": Record<string, never>;
  "history:redo": Record<string, never>;
};

export type EngineHookName = keyof EngineHooks;

type Listener<K extends EngineHookName> = (payload: EngineHooks[K]) => void;

class EngineHookBus {
  private listeners = new Map<EngineHookName, Set<Listener<EngineHookName>>>();

  on<K extends EngineHookName>(name: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(listener as Listener<EngineHookName>);
    return () => set!.delete(listener as Listener<EngineHookName>);
  }

  emit<K extends EngineHookName>(name: K, payload: EngineHooks[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    // 구독자가 많지 않을 것이므로 단순 순회로 충분하다.
    for (const listener of set) listener(payload);
  }
}

// 노트는 한 화면에 하나뿐이라 모듈 전역 싱글턴으로 둔다 (엔진 쪽 DrawingCanvas 인스턴스와
// 이벤트 시스템 양쪽에서 같은 버스를 import해서 쓴다).
export const engineHooks = new EngineHookBus();
