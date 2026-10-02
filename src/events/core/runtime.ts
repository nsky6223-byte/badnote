// 이벤트 런타임: 엔진 훅을 구독해 트리거를 평가하고, 디렉터에게 "뭘 터뜨릴지" 물어본
// 뒤, 실제로 이벤트 모듈을 로드/실행한다. EVENTS_SPEC.md 10장 계획에는 별도 이름이
// 없지만, hooks.ts·director.ts·triggers/*가 서로 연결되어 "첫 이벤트 3종"이 실제로
// 작동하려면 반드시 필요한 접착부다.
//
// 단일 노트 앱이라 싱글턴으로 둔다. DrawingCanvas가 마운트될 때 start()로 실제
// EngineAdapter를 등록하고, 언마운트될 때 반환된 정리 함수를 호출한다.

import { engineHooks, type EngineHookName } from "../../canvas/engine/hooks";
import type { Stroke } from "../../canvas/engine/strokeEngine";
import { evaluateChance } from "../triggers/chance";
import { evaluateCondition } from "../triggers/condition";
import { IdleTracker } from "../triggers/idle";
import { PityCounter } from "../triggers/pity";
import {
  chooseEvent,
  createDirectorState,
  markFired,
  markMemeEnded,
  markMinigameEnded,
  type DirectorState,
  type EventCandidate,
} from "./director";
import type { EngineAdapter } from "./engineAdapter";
import { getAllEvents } from "./registry";
import { createRng, type Rng } from "./rng";
import type { EventCategory, EventContext, EventHandle, GameEvent, TriggerRule } from "./types";

const IDLE_POLL_MS = 1000;

export type RuntimeOptions = {
  adapter: EngineAdapter;
  seed?: number;
  intensity?: number;
};

class EventRuntime {
  private adapter: EngineAdapter | null = null;
  private rng: Rng = createRng(1);
  private state: DirectorState = createDirectorState();
  private unsubscribers: Array<() => void> = [];
  private idleTrackers = new Map<string, IdleTracker>();
  private pityCounters = new Map<string, PityCounter>();
  private enabled = true;
  private disabledCategories = new Set<EventCategory>();

  start(options: RuntimeOptions): () => void {
    this.adapter = options.adapter;
    this.rng = createRng(options.seed ?? Date.now());
    this.state = createDirectorState(options.intensity ?? 0);
    this.idleTrackers.clear();
    this.pityCounters.clear();

    const now = Date.now();
    for (const event of getAllEvents()) {
      for (const trigger of event.triggers) {
        if (trigger.kind === "pity") this.pityCounters.set(event.id, new PityCounter());
        if (trigger.kind === "idle") this.idleTrackers.set(event.id, new IdleTracker(now));
      }
    }

    const subscribe = (name: EngineHookName, handler: () => void) => {
      const off = engineHooks.on(name, handler);
      this.unsubscribers.push(off);
    };

    subscribe("object:commit", () => this.onCommitLikeHook("object:commit"));
    subscribe("erase", () => this.onCommitLikeHook("erase"));
    subscribe("stroke:point", () => this.recordActivity());

    const intervalId = window.setInterval(() => this.checkIdle(), IDLE_POLL_MS);
    this.unsubscribers.push(() => window.clearInterval(intervalId));

    return () => {
      for (const off of this.unsubscribers) off();
      this.unsubscribers = [];
      this.adapter = null;
    };
  }

  setIntensity(intensity: number): void {
    this.state.intensity = intensity;
  }

  setCategoryEnabled(category: EventCategory, enabled: boolean): void {
    if (enabled) this.disabledCategories.delete(category);
    else this.disabledCategories.add(category);
  }

  isCategoryEnabled(category: EventCategory): boolean {
    return !this.disabledCategories.has(category);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // 개발자 패널에서 시드를 고정할 때 쓴다. 훅 구독을 다시 걸 필요 없이 RNG만 바꾼다
  // (규칙 6: 같은 시드 → 같은 전개를 재현하기 위함).
  setSeed(seed: number): void {
    this.rng = createRng(seed);
  }

  // 개발자 패널에서 쿨다운/트리거를 무시하고 강제로 하나를 터뜨릴 때 쓴다.
  forceFire(eventId: string): boolean {
    if (!this.adapter) return false;
    const event = getAllEvents().find((e) => e.id === eventId);
    if (!event) return false;
    this.fire({ event, triggerKind: "condition" }, Date.now());
    return true;
  }

  private recordActivity(): void {
    const now = Date.now();
    for (const tracker of this.idleTrackers.values()) tracker.recordActivity(now);
  }

  private onCommitLikeHook(hookName: EngineHookName): void {
    if (!this.enabled || !this.adapter) return;
    const now = Date.now();
    this.recordActivity();

    if (hookName === "object:commit") {
      for (const counter of this.pityCounters.values()) counter.recordStroke();
    }

    this.fireIfChosen(this.collectCandidates(hookName, now), now);
  }

  private checkIdle(): void {
    if (!this.enabled || !this.adapter) return;
    const now = Date.now();
    const candidates: EventCandidate[] = [];

    for (const event of getAllEvents()) {
      if (this.disabledCategories.has(event.category)) continue;
      for (const trigger of event.triggers) {
        if (trigger.kind !== "idle") continue;
        const tracker = this.idleTrackers.get(event.id);
        if (tracker?.isIdle(trigger, now)) {
          candidates.push({ event, triggerKind: "idle" });
          break;
        }
      }
    }

    this.fireIfChosen(candidates, now);
  }

  private collectCandidates(hookName: EngineHookName, now: number): EventCandidate[] {
    const adapter = this.adapter;
    if (!adapter) return [];
    const strokes = adapter.getObjects().filter((o): o is Stroke => o.objectType === "stroke");
    const candidates: EventCandidate[] = [];

    for (const event of getAllEvents()) {
      if (this.disabledCategories.has(event.category)) continue;

      for (const trigger of event.triggers) {
        if (this.matchesTrigger(event, trigger, hookName, strokes, now)) {
          candidates.push({ event, triggerKind: trigger.kind });
          break; // 한 이벤트가 여러 트리거를 동시에 만족해도 후보는 한 번만 추가한다.
        }
      }
    }
    return candidates;
  }

  private matchesTrigger(
    event: GameEvent,
    trigger: TriggerRule,
    hookName: EngineHookName,
    strokes: Stroke[],
    now: number,
  ): boolean {
    switch (trigger.kind) {
      case "chance":
        return trigger.on === hookName && evaluateChance(trigger, this.rng);
      case "condition":
        return trigger.on === hookName && evaluateCondition(trigger, this.makeContext(now));
      case "shape": {
        if (hookName !== "object:commit" || strokes.length === 0) return false;
        const recent = strokes.slice(-8); // 최근 몇 개 스트로크만 본다 (적절성/성능).
        return trigger.detector(recent) >= trigger.minConfidence;
      }
      case "pity":
        return this.pityCounters.get(event.id)?.isDue(trigger) ?? false;
      case "idle":
        return false; // idle은 checkIdle()의 폴링 루프에서만 후보가 된다.
    }
  }

  private fireIfChosen(candidates: EventCandidate[], now: number): void {
    const chosen = chooseEvent(candidates, this.state, now);
    if (chosen) this.fire(chosen, now);
  }

  private fire(candidate: EventCandidate, now: number): void {
    markFired(this.state, candidate, now);
    this.pityCounters.get(candidate.event.id)?.reset();

    const ctx = this.makeContext(now);
    candidate.event
      .load()
      .then((module) => module.run(ctx))
      .then((handle) => this.handleResult(candidate, handle))
      .catch(() => this.endEvent(candidate));
  }

  private handleResult(candidate: EventCandidate, handle: EventHandle): void {
    const cleanup = () => {
      handle.revert?.();
      this.endEvent(candidate);
    };

    if (handle.result) {
      handle.result.then((result) => {
        if (result.objectsToAdd && result.objectsToAdd.length > 0) {
          this.adapter?.addObjects(result.objectsToAdd);
        }
        cleanup();
      });
      return;
    }

    if (handle.durationMs !== undefined) {
      window.setTimeout(cleanup, handle.durationMs);
    }
    // durationMs도 result도 없으면 이벤트 자신이 알아서 정리를 관리한다고 보고
    // 아무것도 하지 않는다 (예: ui 글리치가 스스로 revert를 나중에 호출하는 경우는
    // 현재 설계엔 없지만 미래 확장을 막지 않기 위해 남겨둔다).
  }

  private endEvent(candidate: EventCandidate): void {
    if (candidate.event.category === "minigame") markMinigameEnded(this.state, candidate.event.id);
    if (candidate.event.category === "meme") markMemeEnded(this.state, candidate.event.id);
  }

  private makeContext(now: number): EventContext {
    const adapter = this.adapter;
    if (!adapter) throw new Error("이벤트 런타임이 아직 시작되지 않았습니다.");
    return {
      objects: adapter.getObjects(),
      intensity: this.state.intensity,
      rng: this.rng,
      now,
      addObjects: (objects) => adapter.addObjects(objects),
      updateObject: (id, patch) => adapter.updateObject(id, patch),
      pauseInput: () => adapter.pauseInput(),
      resumeInput: () => adapter.resumeInput(),
      requestRedraw: () => adapter.requestRedraw(),
    };
  }
}

export const eventRuntime = new EventRuntime();
