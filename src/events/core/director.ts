// 디렉터: "후보 중 무엇을 실제로 터뜨릴지" 결정한다 (EVENTS_SPEC.md 4장).
//
// 중요한 범위 제한 한 가지: "필기 도중에는 절대 발동하지 않는다. 발동 시점은
// stroke:commit 또는 idle뿐"(규칙 1)은 디렉터 *자신*이 강제할 수 있는 규칙이 아니라,
// 디렉터를 "언제 호출하느냐"에 대한 약속이다. 이 파일은 트리거 평가 루프에 아직
// 연결되지 않았으므로(이번 단계 범위 밖), 규칙 1은 여기서 테스트하지 않고 향후
// "엔진 훅을 구독해 director를 호출하는 쪽"의 책임으로 남겨둔다.
//
// 규칙 6(시드 RNG)도 마찬가지로 "chance 트리거가 확률을 평가할 때" 적용되는 것이라
// 트리거 구현(다음 단계) 쪽 책임이다. 디렉터는 이미 걸러진 후보 중에서 고르기만 하므로
// 이 파일 자체는 난수를 쓰지 않는다 — 우선순위가 같으면 배열 순서대로 결정론적으로 고른다.

import type { EventCategory, GameEvent, TriggerRule } from "./types";

export type EventCandidate = {
  event: GameEvent;
  triggerKind: TriggerRule["kind"];
};

export type DirectorState = {
  intensity: number;
  activeMinigame: string | null;
  activeMemes: Set<string>;
  lastFiredAt: Map<string, number>; // eventId -> timestamp
  categoryLastFiredAt: Map<EventCategory, number>;
};

export function createDirectorState(intensity = 0): DirectorState {
  return {
    intensity,
    activeMinigame: null,
    activeMemes: new Set(),
    lastFiredAt: new Map(),
    categoryLastFiredAt: new Map(),
  };
}

// 밈 동시 발생 한도. 미니게임은 늘 1개뿐이라 별도 상수가 필요 없다 (규칙 3).
export const MAX_CONCURRENT_MEMES = 2;

// 카테고리 전역 쿨다운. 정확한 값은 EVENTS_SPEC.md 9장에서 아직 "미정"이라
// 규칙 4가 요구하는 최소 기준(미니게임 3분 이상)만 확정하고 밈은 임시값을 둔다.
export const CATEGORY_COOLDOWN_MS: Record<EventCategory, number> = {
  minigame: 3 * 60 * 1000,
  meme: 10 * 1000,
  glitch: 0,
};

// 우선순위: shape > condition > pity > chance (규칙 2). idle은 발동 "시점" 자체가
// stroke:commit과 다르므로(규칙 1) 같은 호출에서 chance/condition 등과 경쟁할 일이
// 실질적으로 없다 — 편의상 chance와 동급으로 둔다.
const TRIGGER_RANK: Record<TriggerRule["kind"], number> = {
  shape: 0,
  condition: 1,
  pity: 2,
  chance: 3,
  idle: 3,
};

export function compareCandidates(a: EventCandidate, b: EventCandidate): number {
  const rankDiff = TRIGGER_RANK[a.triggerKind] - TRIGGER_RANK[b.triggerKind];
  if (rankDiff !== 0) return rankDiff;
  return b.event.priority - a.event.priority; // priority는 클수록 우선.
}

export function isEligible(candidate: EventCandidate, state: DirectorState, now: number): boolean {
  const { event } = candidate;

  // 강도 곡선 해금 (규칙 5).
  if (event.unlockAt !== undefined && state.intensity < event.unlockAt) return false;

  // 미니게임 진행 중에는 그 무엇도 새로 발동할 수 없다 (규칙 3).
  if (state.activeMinigame !== null) return false;

  // 밈 동시 발생 한도 (규칙 3).
  if (event.category === "meme" && state.activeMemes.size >= MAX_CONCURRENT_MEMES) return false;

  // 이벤트별 쿨다운 (규칙 4).
  const lastFired = state.lastFiredAt.get(event.id);
  if (lastFired !== undefined && now - lastFired < event.cooldownMs) return false;

  // 카테고리 전역 쿨다운 (규칙 4).
  const categoryCooldownMs = CATEGORY_COOLDOWN_MS[event.category];
  const lastCategoryFired = state.categoryLastFiredAt.get(event.category);
  if (lastCategoryFired !== undefined && now - lastCategoryFired < categoryCooldownMs) return false;

  return true;
}

// 후보 중 실제로 발동할 하나를 고른다. 없으면 null.
export function chooseEvent(
  candidates: readonly EventCandidate[],
  state: DirectorState,
  now: number,
): EventCandidate | null {
  const eligible = candidates.filter((c) => isEligible(c, state, now));
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareCandidates)[0];
}

// chooseEvent가 고른 후보를 실제로 쏘기로 했을 때 상태를 갱신한다 (쿨다운 기록,
// 미니게임/밈 점유 표시). 실행 자체(이벤트 모듈 load/run)는 디렉터의 책임이 아니다.
export function markFired(state: DirectorState, candidate: EventCandidate, now: number): void {
  const { event } = candidate;
  state.lastFiredAt.set(event.id, now);
  state.categoryLastFiredAt.set(event.category, now);
  if (event.category === "minigame") state.activeMinigame = event.id;
  if (event.category === "meme") state.activeMemes.add(event.id);
}

export function markMinigameEnded(state: DirectorState, eventId: string): void {
  if (state.activeMinigame === eventId) state.activeMinigame = null;
}

export function markMemeEnded(state: DirectorState, eventId: string): void {
  state.activeMemes.delete(eventId);
}
