// EVENTS_SPEC.md 7장의 핵심 타입. 문서 원문은 Stroke[] 단일 모델을 가정하지만, 실제
// 엔진은 Stroke/Shape/Image/Text/Sticker를 아우르는 CanvasObject로 확장되어 있으므로
// EventContext/EventResult 등은 CanvasObject 기준으로 옮겼다. 단, "모양 인식(shape 트리거)"은
// 스펙 3-1장이 명시한 대로 사용자가 펜으로 그린 스트로크에만 반응하는 것이므로
// ShapeDetector의 입력은 Stroke[]로 남겨둔다 (예: 격자를 그리면 오목판이 뜨는 식 —
// 도형 툴로 그린 사각형과는 다른, "낙서가 노트에 반응하는" 경험).

import type { EngineHookName } from "../../canvas/engine/hooks";
import type { CanvasObject } from "../../canvas/engine/objectOps";
import type { Stroke } from "../../canvas/engine/strokeEngine";
import type { Rng } from "./rng";

export type EventCategory = "glitch" | "meme" | "minigame";

// 글리치가 개입하는 지점 4종 (EVENTS_SPEC.md 2-1장).
// input: 그리는 중인 포인트 / data: 확정된 오브젝트 데이터 / render: 그리는 방식만 /
// ui: DOM·툴바. render·ui는 원본 데이터를 건드리지 않아 가장 안전하다.
export type GlitchKind = "input" | "data" | "render" | "ui";

// 손으로 그린 스트로크가 어떤 모양에 가까운지 0~1의 확신도로 답하는 순수 함수.
// ML 없이 휴리스틱으로 구현한다 (EVENTS_SPEC.md 3-1장).
export type ShapeDetector = (strokes: readonly Stroke[]) => number;

export type TriggerRule =
  // 훅이 올 때마다 p 확률로 후보가 된다 (예: 스트로크 커밋마다 3% 고양이 등장).
  | { kind: "chance"; on: EngineHookName; p: number }
  // 조건이 참이면 확정 후보가 된다 (예: undo 5연타 → 요원 등장).
  | { kind: "condition"; on: EngineHookName; when: (ctx: EventContext) => boolean }
  // 그린 모양의 확신도가 minConfidence 이상이면 확정 후보가 된다.
  | { kind: "shape"; detector: ShapeDetector; minConfidence: number }
  // 일정 시간 입력이 없으면 확정 후보가 된다.
  | { kind: "idle"; ms: number }
  // 지정한 스트로크 수만큼 아무 일도 없었으면 확정 후보가 된다 (천장).
  | { kind: "pity"; afterStrokes: number };

export interface GameEvent {
  id: string;
  category: EventCategory;
  glitchKind?: GlitchKind; // category === "glitch"일 때만 의미가 있다.
  triggers: TriggerRule[]; // 이 중 하나라도 맞으면 발동 후보가 된다.
  priority: number; // 같은 트리거 종류 안에서 후보끼리 비교할 때 쓰는 가중치 (클수록 우선).
  cooldownMs: number; // 이 이벤트 자신의 재발동 최소 간격.
  unlockAt?: number; // 이 값 이상 intensity에서만 후보가 될 수 있다.
  load: () => Promise<EventModule>; // 실제로 발동할 때만 동적 import (초기 번들을 가볍게 유지).
}

export interface EventContext {
  objects: readonly CanvasObject[];
  intensity: number;
  rng: Rng;
  now: number;
  // 이벤트는 엔진 내부 상태를 직접 import/수정하지 않고 이 API로만 조작한다.
  addObjects(objects: CanvasObject[]): void;
  updateObject(id: string, patch: Partial<CanvasObject>): void;
  pauseInput(): void;
  resumeInput(): void;
}

export interface EventModule {
  run(ctx: EventContext): EventHandle | Promise<EventHandle>;
}

export interface EventHandle {
  durationMs?: number;
  revert?(): void; // render/ui 글리치, 밈이 스스로를 정리하는 방법.
  result?: Promise<EventResult>; // 미니게임이 끝났을 때.
}

export interface EventResult {
  outcome: "win" | "lose" | "draw" | "skip";
  objectsToAdd?: CanvasObject[]; // 노트에 영구히 남길 결과물 (예: 오목판 바둑돌).
}
