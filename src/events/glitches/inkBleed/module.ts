// inkBleed: 가장 최근 스트로크에 잠깐 블러를 걸어 "잉크가 번지는" 느낌을 낸다.
// render 글리치라 Stroke 데이터는 전혀 건드리지 않고, 엔진의 renderPipeline(오버라이드
// 레지스트리)에만 흔적을 남긴다 — 기간이 끝나면 자동으로 원상복구된다.

import { renderOverrides } from "../../../canvas/engine/renderPipeline";
import type { EventContext, EventHandle, EventModule } from "../../core/types";

export const INK_BLEED_DURATION_MS = 2500;
const BLEED_FILTER = "blur(2.5px)";

const inkBleedModule: EventModule = {
  run(ctx: EventContext): EventHandle {
    const strokes = ctx.objects.filter((o) => o.objectType === "stroke");
    const target = strokes.length > 0 ? strokes[strokes.length - 1] : undefined;

    if (target) {
      renderOverrides.set(target.id, { filter: BLEED_FILTER });
      ctx.requestRedraw();
    }

    return {
      durationMs: INK_BLEED_DURATION_MS,
      revert: () => {
        if (target) {
          renderOverrides.clear(target.id);
          ctx.requestRedraw();
        }
      },
    };
  },
};

export default inkBleedModule;
