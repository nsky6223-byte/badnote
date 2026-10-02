// 순수 로직: 고양이가 왼쪽/오른쪽 어디서 나타나 얼마나 걸릴지만 정한다.
// React를 import하지 않아 테스트가 가볍다.

import type { Rng } from "../../core/rng";

export type CatWalkPlan = {
  fromLeft: boolean;
  durationMs: number;
};

const MIN_DURATION_MS = 3000;
const DURATION_RANGE_MS = 1500;

export function planCatWalk(rng: Rng): CatWalkPlan {
  return {
    fromLeft: rng.chance(0.5),
    durationMs: MIN_DURATION_MS + rng.int(DURATION_RANGE_MS),
  };
}
