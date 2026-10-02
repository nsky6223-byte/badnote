import { createElement } from "react";
import type { EventContext, EventHandle, EventModule } from "../../core/types";
import { mountOverlay } from "../../shared/overlayMount";
import CatMeme from "./CatMeme";
import { planCatWalk } from "./logic";

const catModule: EventModule = {
  run(ctx: EventContext): EventHandle {
    const plan = planCatWalk(ctx.rng);

    const unmount = mountOverlay(
      createElement(CatMeme, {
        fromLeft: plan.fromLeft,
        durationMs: plan.durationMs,
        onDone: () => unmount(),
      }),
    );

    return { durationMs: plan.durationMs, revert: unmount };
  },
};

export default catModule;
