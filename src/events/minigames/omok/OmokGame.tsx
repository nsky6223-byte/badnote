import { useState } from "react";
import type { Rng } from "../../core/rng";
import {
  BOARD_SIZE,
  checkWin,
  chooseAiMove,
  createEmptyBoard,
  isBoardFull,
  placeStone,
  type Board,
} from "./logic";
import "./OmokGame.css";

type Outcome = "win" | "lose" | "draw";

type Props = {
  rng: Rng;
  onFinish: (board: Board, outcome: Outcome) => void;
};

const AI_THINK_MS = 500;
const FINISH_DELAY_MS = 900;

export default function OmokGame({ rng, onFinish }: Props) {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [turn, setTurn] = useState<"player" | "ai">("player");
  const [status, setStatus] = useState("당신 차례 (검은돌)");
  const [done, setDone] = useState(false);

  const finish = (finalBoard: Board, outcome: Outcome, message: string) => {
    setStatus(message);
    setDone(true);
    window.setTimeout(() => onFinish(finalBoard, outcome), FINISH_DELAY_MS);
  };

  const handleCellClick = (row: number, col: number) => {
    if (done || turn !== "player" || board[row][col] !== null) return;

    const afterPlayer = placeStone(board, row, col, "black");
    setBoard(afterPlayer);

    if (checkWin(afterPlayer, row, col)) {
      finish(afterPlayer, "win", "승리! 🎉");
      return;
    }
    if (isBoardFull(afterPlayer)) {
      finish(afterPlayer, "draw", "무승부");
      return;
    }

    setTurn("ai");
    setStatus("상대 차례...");

    window.setTimeout(() => {
      const move = chooseAiMove(afterPlayer, rng);
      if (!move) {
        finish(afterPlayer, "draw", "무승부");
        return;
      }

      const [ar, ac] = move;
      const afterAi = placeStone(afterPlayer, ar, ac, "white");
      setBoard(afterAi);

      if (checkWin(afterAi, ar, ac)) {
        finish(afterAi, "lose", "패배... 😿");
        return;
      }
      if (isBoardFull(afterAi)) {
        finish(afterAi, "draw", "무승부");
        return;
      }

      setTurn("player");
      setStatus("당신 차례 (검은돌)");
    }, AI_THINK_MS);
  };

  return (
    <div className="omok-game">
      <p className="omok-game__status">{status}</p>
      <div className="omok-game__board" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              className="omok-game__cell"
              onClick={() => handleCellClick(r, c)}
              disabled={done || turn !== "player" || cell !== null}
              aria-label={`${r + 1}행 ${c + 1}열`}
            >
              {cell && <span className={`omok-game__stone omok-game__stone--${cell}`} />}
            </button>
          )),
        )}
      </div>
    </div>
  );
}
