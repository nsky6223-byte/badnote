// 오목 판정/AI 순수 로직. React 의존 없음 — 테스트 대상.
// "병맛 오목"이라 AI는 즉시 승리/필수 방어만 챙기고 나머지는 적당히 무작위로 둔다
// (EVENTS_SPEC.md 2-3장: 깊게 수읽기하는 강한 AI가 아니라 캐주얼한 미니게임).

import type { Rng } from "../../core/rng";

export type Stone = "black" | "white" | null;
export type Board = Stone[][];
export type Cell = [number, number];

export const BOARD_SIZE = 9;
const WIN_LENGTH = 5;
const DIRECTIONS: Cell[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<Stone>(BOARD_SIZE).fill(null));
}

export function placeStone(board: Board, row: number, col: number, stone: Stone): Board {
  const next = board.map((r) => [...r]);
  next[row][col] = stone;
  return next;
}

function countDirection(board: Board, row: number, col: number, dr: number, dc: number, stone: Stone): number {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === stone) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

export function checkWin(board: Board, row: number, col: number): boolean {
  const stone = board[row][col];
  if (!stone) return false;

  for (const [dr, dc] of DIRECTIONS) {
    const count = 1 + countDirection(board, row, col, dr, dc, stone) + countDirection(board, row, col, -dr, -dc, stone);
    if (count >= WIN_LENGTH) return true;
  }
  return false;
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function getEmptyCells(board: Board): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) cells.push([r, c]);
    }
  }
  return cells;
}

function hasNeighborStone(board: Board, row: number, col: number): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] !== null) return true;
    }
  }
  return false;
}

// AI(백돌) 차례. 1) 즉시 이길 수 있으면 이긴다. 2) 상대(흑돌)가 다음 수에 이길 수
// 있으면 막는다. 3) 그 외엔 기존 돌 근처의 빈 칸 중 하나를 무작위로 고른다.
export function chooseAiMove(board: Board, rng: Rng): Cell | null {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return null;

  for (const [r, c] of empty) {
    if (checkWin(placeStone(board, r, c, "white"), r, c)) return [r, c];
  }

  for (const [r, c] of empty) {
    if (checkWin(placeStone(board, r, c, "black"), r, c)) return [r, c];
  }

  const near = empty.filter(([r, c]) => hasNeighborStone(board, r, c));
  const pool = near.length > 0 ? near : empty;
  return rng.pick(pool);
}
