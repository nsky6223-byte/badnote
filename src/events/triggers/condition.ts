// condition 트리거: 훅이 올 때 조건 함수가 참이면 확정 후보가 된다 (EVENTS_SPEC.md 3장).
// 판정 자체는 이벤트가 정의한 when()에 맡기고, 여기서는 EventContext를 그대로 넘기는
// 얇은 통로 역할만 한다 — 그래도 트리거 평가 루프가 "chance/condition/shape/idle/pity를
// 똑같은 모양으로 다룰 수 있게" 각 kind마다 evaluate 함수를 두는 구조를 맞춘다.

import type { EventContext, TriggerRule } from "../core/types";

export function evaluateCondition(
  rule: Extract<TriggerRule, { kind: "condition" }>,
  ctx: EventContext,
): boolean {
  return rule.when(ctx);
}
