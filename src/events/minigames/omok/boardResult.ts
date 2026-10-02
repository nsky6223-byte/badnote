// 게임이 끝나면 바둑돌 배치를 노트에 영구히 남길 Stroke로 바꾼다 (EVENTS_SPEC.md 8장:
// "결과를 스트로크 데이터로 노트에 남기는 것이 배드노트다운 장치"). 점 하나짜리
// 스트로크는 perfect-freehand가 원형으로 그려주므로 바둑돌처럼 보인다.

import type { Stroke } from "../../../canvas/engine/strokeEngine";
import { BOARD_SIZE, type Board } from "./logic";

const CELL_SIZE = 36;
const ORIGIN_X = 60;
const ORIGIN_Y = 60;
const STONE_SIZE = 28;

export function boardToStrokes(board: Board): Stroke[] {
  const strokes: Stroke[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const stone = board[r][c];
      if (!stone) continue;

      const x = ORIGIN_X + c * CELL_SIZE;
      const y = ORIGIN_Y + r * CELL_SIZE;

      strokes.push({
        id: crypto.randomUUID(),
        objectType: "stroke",
        kind: "pen",
        color: stone === "black" ? "#1a1a1a" : "#f1f3f5",
        size: STONE_SIZE,
        sharpness: 100,
        opacity: 1,
        pointerKind: "mouse",
        points: [{ x, y, pressure: 0.7, tiltX: 0, tiltY: 0, t: Date.now() }],
      });
    }
  }

  return strokes;
}
