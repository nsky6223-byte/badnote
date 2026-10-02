// pity 트리거(천장): 지정한 스트로크 수만큼 아무 일도 없으면 확정 후보가 된다
// (EVENTS_SPEC.md 3장, 예: "50스트로크 동안 무발동 → 강제 발동").
//
// 이벤트마다 자기만의 천장 카운터를 갖는다 — 그래서 이 트리거를 쓰는 각 GameEvent가
// 자신의 PityCounter 인스턴스를 하나씩 들고 있어야 한다. 카운트를 언제 올릴지
// (stroke:commit 때마다 등)와, 실제로 발동했을 때 reset()을 호출하는 것도 트리거 평가
// 루프(다음 단계)의 책임이다.

import type { TriggerRule } from "../core/types";

export class PityCounter {
  private count = 0;

  recordStroke(): void {
    this.count += 1;
  }

  reset(): void {
    this.count = 0;
  }

  get strokesSinceReset(): number {
    return this.count;
  }

  isDue(rule: Extract<TriggerRule, { kind: "pity" }>): boolean {
    return this.count >= rule.afterStrokes;
  }
}
