// 미니게임 생명주기 단계 (EVENTS_SPEC.md 8장): enter → play → result → exit.
// 각 미니게임의 module.ts가 이 타입을 기준으로 상태를 다루면 모양이 일관된다.

export type MiniGamePhase = "enter" | "play" | "result" | "exit";
