import type { EventContext, EventHandle, EventModule, EventResult } from "../../core/types";
import { mountOverlay } from "../../shared/overlayMount";
import MiniGameHost from "../shared/MiniGameHost";
import { boardToStrokes } from "./boardResult";
import type { Board } from "./logic";
import OmokGame from "./OmokGame";

const omokModule: EventModule = {
  run(ctx: EventContext): EventHandle {
    ctx.pauseInput(); // 미니게임이 열려있는 동안은 필기를 막는다 (EVENTS_SPEC.md 2장).

    let resolveResult: (result: EventResult) => void;
    const resultPromise = new Promise<EventResult>((resolve) => {
      resolveResult = resolve;
    });

    const finishWith = (outcome: EventResult["outcome"], board?: Board) => {
      ctx.resumeInput();
      unmount();
      resolveResult({
        outcome,
        objectsToAdd: board ? boardToStrokes(board) : undefined,
      });
    };

    const handleFinish = (board: Board, outcome: "win" | "lose" | "draw") => finishWith(outcome, board);
    const handleSkip = () => finishWith("skip");

    const unmount = mountOverlay(
      <MiniGameHost title="병맛 오목" onSkip={handleSkip}>
        <OmokGame rng={ctx.rng} onFinish={handleFinish} />
      </MiniGameHost>,
      { interactive: true },
    );

    return { result: resultPromise };
  },
};

export default omokModule;
