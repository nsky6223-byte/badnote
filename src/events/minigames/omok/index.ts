import { detectGrid } from "../../triggers/shape/grid";
import type { GameEvent } from "../../core/types";

export const omokEvent: GameEvent = {
  id: "minigame:omok",
  category: "minigame",
  triggers: [{ kind: "shape", detector: detectGrid, minConfidence: 0.6 }],
  priority: 0,
  // 이벤트 자신의 쿨다운. 미니게임 카테고리 전역 쿨다운(director.ts, 최소 3분)이 이보다
  // 크므로 실질적으로는 그쪽이 적용된다.
  cooldownMs: 60000,
  load: () => import("./module").then((m) => ({ run: m.default.run })),
};
