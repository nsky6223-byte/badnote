import type { GameEvent } from "../../core/types";

export const catEvent: GameEvent = {
  id: "meme:cat",
  category: "meme",
  triggers: [{ kind: "chance", on: "object:commit", p: 0.03 }],
  priority: 0,
  cooldownMs: 20000,
  load: () => import("./module").then((m) => ({ run: m.default.run })),
};
