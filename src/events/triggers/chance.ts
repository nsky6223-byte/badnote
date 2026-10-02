// chance 트리거: 훅이 올 때마다 p 확률로 후보가 된다 (EVENTS_SPEC.md 3장).
// 반드시 ctx.rng를 거쳐야 한다 — Math.random()을 직접 쓰면 시드 재현이 깨진다 (규칙 6).

import type { Rng } from "../core/rng";
import type { TriggerRule } from "../core/types";

export function evaluateChance(rule: Extract<TriggerRule, { kind: "chance" }>, rng: Rng): boolean {
  return rng.chance(rule.p);
}
