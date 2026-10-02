// EVENTS_SPEC.md 4장(디렉터 규칙)에 대한 단위 테스트.
// 규칙 1(필기 도중 발동 금지)과 규칙 6(시드 RNG)은 director.ts 자체가 아니라 director를
// 호출하는 시점/트리거 평가 쪽 책임이라 director.ts 상단 주석에서 설명한 대로 여기서는
// 다루지 않는다 (아직 트리거 평가 루프가 없음).

import { describe, expect, it } from "vitest";
import {
  CATEGORY_COOLDOWN_MS,
  MAX_CONCURRENT_MEMES,
  chooseEvent,
  compareCandidates,
  createDirectorState,
  isEligible,
  markFired,
  markMinigameEnded,
  type EventCandidate,
} from "./director";
import type { GameEvent } from "./types";

function makeEvent(overrides: Partial<GameEvent> & Pick<GameEvent, "id" | "category">): GameEvent {
  return {
    triggers: [],
    priority: 0,
    cooldownMs: 0,
    load: () => Promise.reject(new Error("테스트에서는 load를 호출하지 않는다")),
    ...overrides,
  };
}

function candidate(
  event: GameEvent,
  triggerKind: EventCandidate["triggerKind"] = "chance",
): EventCandidate {
  return { event, triggerKind };
}

describe("규칙 2: 우선순위 shape > condition > pity > chance", () => {
  it("트리거 종류가 다르면 shape가 가장 먼저 온다", () => {
    const shapeC = candidate(makeEvent({ id: "a", category: "glitch" }), "shape");
    const conditionC = candidate(makeEvent({ id: "b", category: "glitch" }), "condition");
    const pityC = candidate(makeEvent({ id: "c", category: "glitch" }), "pity");
    const chanceC = candidate(makeEvent({ id: "d", category: "glitch" }), "chance");

    const sorted = [chanceC, pityC, conditionC, shapeC].sort(compareCandidates);
    expect(sorted.map((c) => c.event.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("같은 트리거 종류끼리는 GameEvent.priority가 큰 쪽이 우선한다", () => {
    const low = candidate(makeEvent({ id: "low", category: "glitch", priority: 1 }), "chance");
    const high = candidate(makeEvent({ id: "high", category: "glitch", priority: 5 }), "chance");

    const chosen = chooseEvent([low, high], createDirectorState(), 0);
    expect(chosen?.event.id).toBe("high");
  });
});

describe("규칙 3: 동시 실행 제한", () => {
  it("미니게임이 진행 중이면 어떤 이벤트도 새로 발동할 수 없다", () => {
    const state = createDirectorState();
    state.activeMinigame = "omok";

    const glitch = candidate(makeEvent({ id: "ink", category: "glitch" }));
    const meme = candidate(makeEvent({ id: "cat", category: "meme" }));
    const anotherMinigame = candidate(makeEvent({ id: "sports", category: "minigame" }));

    expect(isEligible(glitch, state, 0)).toBe(false);
    expect(isEligible(meme, state, 0)).toBe(false);
    expect(isEligible(anotherMinigame, state, 0)).toBe(false);
  });

  it(`밈은 동시에 최대 ${MAX_CONCURRENT_MEMES}개까지만 허용된다`, () => {
    const state = createDirectorState();
    state.activeMemes.add("cat");
    state.activeMemes.add("dog");

    const anotherMeme = candidate(makeEvent({ id: "frog", category: "meme" }));
    expect(isEligible(anotherMeme, state, 0)).toBe(false);

    state.activeMemes.delete("dog");
    expect(isEligible(anotherMeme, state, 0)).toBe(true);
  });
});

describe("규칙 4: 쿨다운", () => {
  it("이벤트별 cooldownMs가 지나기 전에는 후보가 될 수 없다", () => {
    // glitch는 카테고리 전역 쿨다운이 0이라, 이벤트 자신의 cooldownMs만 순수하게 본다.
    const state = createDirectorState();
    const event = makeEvent({ id: "inkBleed", category: "glitch", cooldownMs: 5000 });
    markFired(state, candidate(event), 1000);

    expect(isEligible(candidate(event), state, 1000 + 4999)).toBe(false);
    expect(isEligible(candidate(event), state, 1000 + 5000)).toBe(true);
  });

  it("같은 카테고리 전역 쿨다운이 지나기 전에는 다른 이벤트도 후보가 될 수 없다", () => {
    const state = createDirectorState();
    const omok = makeEvent({ id: "omok", category: "minigame" });
    const sports = makeEvent({ id: "sports", category: "minigame" });
    markFired(state, candidate(omok), 0);
    markMinigameEnded(state, "omok"); // 오목판이 끝나 더 이상 "진행 중" 규칙(3)에는 안 걸림.

    // 그래도 미니게임 카테고리 쿨다운(최소 3분)이 지나기 전에는 다른 미니게임이 막힌다.
    expect(isEligible(candidate(sports), state, CATEGORY_COOLDOWN_MS.minigame - 1)).toBe(false);
    expect(isEligible(candidate(sports), state, CATEGORY_COOLDOWN_MS.minigame)).toBe(true);
  });
});

describe("규칙 5: 강도 곡선", () => {
  it("unlockAt보다 intensity가 낮으면 후보가 될 수 없다", () => {
    const state = createDirectorState(10);
    const event = makeEvent({ id: "omok", category: "minigame", unlockAt: 50 });

    expect(isEligible(candidate(event), state, 0)).toBe(false);

    state.intensity = 50;
    expect(isEligible(candidate(event), state, 0)).toBe(true);
  });

  it("unlockAt이 없으면 intensity와 무관하게 후보가 될 수 있다", () => {
    const state = createDirectorState(0);
    const event = makeEvent({ id: "inkBleed", category: "glitch" });
    expect(isEligible(candidate(event), state, 0)).toBe(true);
  });
});

describe("chooseEvent", () => {
  it("후보가 없으면 null을 반환한다", () => {
    expect(chooseEvent([], createDirectorState(), 0)).toBeNull();
  });

  it("자격 있는 후보가 하나도 없으면(전부 쿨다운 등으로 탈락) null을 반환한다", () => {
    const state = createDirectorState();
    state.activeMinigame = "omok";
    const only = candidate(makeEvent({ id: "cat", category: "meme" }));
    expect(chooseEvent([only], state, 0)).toBeNull();
  });
});
