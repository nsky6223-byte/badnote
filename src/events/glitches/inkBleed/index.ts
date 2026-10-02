import type { GameEvent } from "../../core/types";

export const inkBleedEvent: GameEvent = {
  id: "glitch:inkBleed",
  category: "glitch",
  glitchKind: "render",
  triggers: [{ kind: "chance", on: "object:commit", p: 0.03 }],
  priority: 0,
  cooldownMs: 15000,
  load: () => import("./module").then((m) => ({ run: m.default.run })),
};
