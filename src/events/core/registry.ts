// 모든 이벤트를 등록하는 곳. EVENTS_SPEC.md 5-1장: "새 이벤트 추가 시 해당 폴더 생성 +
// registry.ts에 한 줄 추가 외에 다른 파일을 수정하지 않는다."

import { inkBleedEvent } from "../glitches/inkBleed";
import { catEvent } from "../memes/cat";
import { omokEvent } from "../minigames/omok";
import type { EventCategory, GameEvent } from "./types";

const registry: GameEvent[] = [];
const idSet = new Set<string>();

export function registerEvent(event: GameEvent): void {
  if (idSet.has(event.id)) {
    throw new Error(`이벤트 id가 중복되었습니다: ${event.id}`);
  }
  idSet.add(event.id);
  registry.push(event);
}

registerEvent(inkBleedEvent);
registerEvent(catEvent);
registerEvent(omokEvent);

export function getAllEvents(): readonly GameEvent[] {
  return registry;
}

export function getEventsByCategory(category: EventCategory): GameEvent[] {
  return registry.filter((e) => e.category === category);
}

// 테스트에서 레지스트리를 비우고 다시 시작할 때 사용한다.
export function clearRegistry(): void {
  registry.length = 0;
  idSet.clear();
}
