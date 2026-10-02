// idle 트리거: 일정 시간(ms) 입력이 없으면 확정 후보가 된다 (EVENTS_SPEC.md 3장).
//
// chance/condition과 달리 "훅이 올 때 평가"하는 게 아니라 "아무 훅도 안 올 때" 발동해야
// 하므로, 마지막 활동 시각을 기억했다가 흐른 시간을 재는 작은 상태를 둔다. 엔진 훅
// (stroke:point, object:commit, erase, tool:change 등)이 올 때마다 recordActivity를
// 불러주는 건 이걸 실제로 구동하는 쪽(트리거 평가 루프, 다음 단계)의 책임이다.

import type { TriggerRule } from "../core/types";

export class IdleTracker {
  private lastActivityAt: number;

  constructor(now: number) {
    this.lastActivityAt = now;
  }

  recordActivity(now: number): void {
    this.lastActivityAt = now;
  }

  idleMs(now: number): number {
    return Math.max(0, now - this.lastActivityAt);
  }

  isIdle(rule: Extract<TriggerRule, { kind: "idle" }>, now: number): boolean {
    return this.idleMs(now) >= rule.ms;
  }
}
