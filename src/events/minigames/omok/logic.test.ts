import { describe, expect, it } from "vitest";
import { createRng } from "../../core/rng";
import {
  checkWin,
  chooseAiMove,
  createEmptyBoard,
  getEmptyCells,
  isBoardFull,
  placeStone,
  type Board,
} from "./logic";

function boardFromRows(rows: string[]): Board {
  // "." = 빈칸, "b" = 흑돌, "w" = 백돌. 테스트를 짧게 쓰기 위한 헬퍼.
  return rows.map((row) =>
    row.split("").map((ch) => (ch === "b" ? "black" : ch === "w" ? "white" : null)),
  );
}

describe("checkWin", () => {
  it("가로 5개가 이어지면 승리다", () => {
    const board = boardFromRows([
      ".........",
      ".........",
      ".bbbbb...",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]);
    expect(checkWin(board, 2, 3)).toBe(true);
  });

  it("세로 5개가 이어지면 승리다", () => {
    const board = createEmptyBoard();
    let withStones = board;
    for (let r = 0; r < 5; r++) withStones = placeStone(withStones, r, 4, "white");
    expect(checkWin(withStones, 2, 4)).toBe(true);
  });

  it("대각선 5개가 이어지면 승리다", () => {
    const board = createEmptyBoard();
    let withStones = board;
    for (let i = 0; i < 5; i++) withStones = placeStone(withStones, i, i, "black");
    expect(checkWin(withStones, 2, 2)).toBe(true);
  });

  it("4개만 이어지면 승리가 아니다", () => {
    const board = boardFromRows([
      ".........",
      ".........",
      ".bbbb....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]);
    expect(checkWin(board, 2, 3)).toBe(false);
  });

  it("빈 칸은 승리 판정 대상이 아니다", () => {
    expect(checkWin(createEmptyBoard(), 0, 0)).toBe(false);
  });
});

describe("isBoardFull / getEmptyCells", () => {
  it("빈 보드는 가득 차지 않았고 빈 칸이 BOARD_SIZE^2개다", () => {
    const board = createEmptyBoard();
    expect(isBoardFull(board)).toBe(false);
    expect(getEmptyCells(board)).toHaveLength(81);
  });
});

describe("chooseAiMove", () => {
  it("한 수만 더 두면 이길 수 있으면 그 자리를 둔다", () => {
    // 왼쪽 끝(열 0)에 붙어 있어 승리수가 열 4 하나뿐이도록 만든다 (양쪽 다 열리면
    // 어느 쪽을 고르든 정답이라 테스트가 애매해진다).
    const board = boardFromRows([
      ".........",
      ".........",
      "wwww.....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]);
    const move = chooseAiMove(board, createRng(1));
    expect(move).toEqual([2, 4]);
  });

  it("상대가 다음 수에 이길 수 있으면 막는다", () => {
    const board = boardFromRows([
      ".........",
      ".........",
      "bbbb.....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]);
    const move = chooseAiMove(board, createRng(1));
    expect(move).toEqual([2, 4]);
  });

  it("보드가 가득 차면 null을 반환한다", () => {
    let board = createEmptyBoard();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board = placeStone(board, r, c, (r + c) % 2 === 0 ? "black" : "white");
      }
    }
    expect(chooseAiMove(board, createRng(1))).toBeNull();
  });
});
