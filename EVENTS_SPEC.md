# 이벤트 시스템 스펙 (글리치 · 밈 · 미니게임)

> 대상: Claude Code (VS Code 플러그인). `CLAUDE.md`, `DRAWING_SPEC.md`와 함께 읽고 `src/events/` 아래 코드를 작성한다.
> 이 문서는 배드노트의 **핵심 재미**를 담당하는 이벤트 시스템의 설계 기준이다. 각 결정에 "왜"를 함께 적는다.

---

## 0. 한 줄 요약

배드노트 = **멀쩡한 노트 앱(엔진)** + **그 위에 얹는 말썽(이벤트)**.
엔진은 이벤트의 존재를 모르고, 이벤트는 엔진이 열어준 **훅(hook)** 으로만 개입한다.

```
[엔진 훅 신호] → [트리거 판정] → [디렉터: 최종 발동 결정] → [이벤트 실행]
```

---

## 1. 용어 규칙 (반드시 지킬 것)

DOM 이벤트(`pointerdown` 등)와 헷갈리지 않도록 이름을 구분한다.

| 용어 | 의미 | 코드 이름 |
|---|---|---|
| 엔진 훅 | 엔진이 "지금 이런 일이 일어났다"고 알리는 신호 | `EngineHook`, `hooks.ts` |
| 게임 이벤트 | 노트에 벌어지는 말썽 (글리치/밈/미니게임) | `GameEvent` |
| 트리거 | 이벤트가 발동 후보가 되는 조건 | `TriggerRule` |
| 디렉터 | 후보 중 무엇을 실제로 터뜨릴지 결정하는 관리자 | `director.ts` |

- 코드에서 단독 `Event`라는 이름은 쓰지 않는다 (DOM `Event`와 충돌).

---

## 2. 이벤트 카테고리 3종

| | 글리치 (glitch) | 밈 (meme) | 미니게임 (minigame) |
|---|---|---|---|
| 내용 | 노트가 살짝 고장남 | 캐릭터/짤이 노트 위에 등장 | 노트 위에서 짧은 게임이 열림 |
| 지속 시간 | 순간~수 초 | 2~5초 | 30초~수 분 |
| 필기 방해 | 살짝 | 막지 않음 (오버레이) | **필기 일시정지** |
| 동시 발생 | 여러 개 가능 | 최대 1~2개 | **항상 1개만** |
| 끝난 뒤 | 원상복구 또는 데이터 변형 | 사라짐 | **결과가 노트에 스트로크로 남음** |

### 2-1. 글리치의 개입 지점 4종

| 개입 지점 | 바꾸는 대상 | 예시 | 되돌림 |
|---|---|---|---|
| `input` | 그리는 중인 포인트 | 손떨림 증폭, 선이 휘어짐 | 실시간 |
| `data` | 확정된 `Stroke[]` | 색상 배신, 글자 재배열 | Undo 연동 필요 |
| `render` | 그리는 방식만 (데이터 보존) | 잉크 번짐, 화면 흔들림 | 자동 복구 |
| `ui` | DOM/툴바 | 지우개 도망, 버튼 위치 바뀜 | 자동 복구 |

- `render`/`ui`는 원본 데이터를 건드리지 않아 안전하다 → **첫 구현은 render 계열부터**.

### 2-2. 밈 목록 (1차)

| 폴더 | 콘셉트 | 비고 |
|---|---|---|
| `cat/` | 고양이가 지나가며 필기를 건드림 | 오리지널 캐릭터 |
| `dog/` | 강아지가 와서 노트를 핥고 감 | 오리지널 캐릭터 |
| `frog/` | 개구리 캐릭터 리액션 | **페페 직접 사용 금지** (아래 6장) |
| `agents/` | 검은 정장 요원들이 섬광으로 필기를 "기억 삭제" | **영화 IP 직접 사용 금지** (아래 6장) |
| `stonks/` | 주식 차트 떡상/떡락 짤 | 오리지널 그래픽 |

### 2-3. 미니게임 목록 (1차)

| 폴더 | 콘셉트 | 노트에 남는 결과 (예시) |
|---|---|---|
| `omok/` | 병맛 오목. 노트 위에서 AI와 한 판 | 지면 바둑돌이 필기 위에 그대로 남음 |
| `sports/` | 짧은 스포츠 (공 튕기기 등) | 공이 지나간 궤적이 선으로 남음 |
| `tycoon/` | 30초 초미니 타이쿤 (예: 노트 위 붕어빵 가게) | 매출 그래프가 노트에 그려짐 |

> ☐ `tycoon`은 "타이쿤(경영 시뮬레이션) 장르"로 가정했다. 팀 확인 필요.

---

## 3. 트리거 설계 (이 프로젝트의 핵심)

| 종류 | 동작 | 예시 |
|---|---|---|
| `chance` (확률) | 훅이 올 때마다 p 확률 | 스트로크 커밋마다 3% 고양이 등장 |
| `condition` (조건, 확정) | 조건 충족 시 확정 | Undo 5연타 → 요원들이 기억 삭제 |
| `shape` (모양 인식, 확정) | 그린 모양을 인식 | 격자 → 오목판 등장, 우하향 지그재그 → 떡락 주식짤 |
| `idle` (시간) | 일정 시간 입력 없음 | 10초 안 그리면 강아지 등장 |
| `pity` (천장) | N번 아무 일 없으면 확정 | 50스트로크 동안 무발동 → 강제 발동 |

### 3-1. 모양 인식 (shape) 원칙
- **"내가 그린 것에 노트가 반응한다"** 는 경험이 배드노트의 차별점이다. 스트로크를 벡터로 저장하는 이유가 여기서 살아난다.
- ML 없이 **휴리스틱 순수 함수**로 구현한다. 입력 `Stroke[]`, 출력 `confidence: 0~1`.
  - `closedLoop.ts`: 시작점-끝점 거리가 스트로크 크기 대비 작으면 닫힌 도형
  - `grid.ts`: 가로/세로 직선 여러 개가 교차하면 격자
  - `trend.ts`: 포인트 y값 추세(선형 회귀 기울기) + 꺾임 수로 상승/하락 차트
- 순수 함수이므로 단위 테스트 필수.

---

## 4. 디렉터 규칙 (게임성을 결정)

1. **필기 도중에는 절대 발동하지 않는다.** 발동 시점은 `stroke:commit` 또는 idle뿐. (선 긋는 중 화면이 바뀌면 재미가 아니라 짜증)
2. **우선순위:** `shape` > `condition` > `pity` > `chance`. 사용자가 의도한 반응이 운보다 먼저.
3. **동시 실행 제한:** 미니게임 1개, 밈 최대 2개. 미니게임 진행 중에는 다른 이벤트 발동 금지.
4. **쿨다운:** 이벤트별 `cooldownMs` + 카테고리 전역 쿨다운 (미니게임은 최소 3분, 밈은 짧게).
5. **강도 곡선:** 진행도(`intensity`)에 따라 해금.
   - 시작 직후 1~2분: 아무 일 없음 또는 아주 약한 글리치 → "굿노트인 척" 하는 시간
   - 이후: 밈 해금 → 미니게임 해금
6. **시드 RNG 사용:** 모든 랜덤은 `rng.ts`를 거친다. `Math.random()` 직접 사용 금지. (버그 재현을 위해)

---

## 5. 폴더 구조

```
src/
  canvas/engine/
    hooks.ts              # ★ 신규: 타입드 이벤트 버스 (엔진 → 외부 신호)
    inputPipeline.ts      # ★ 신규: 포인트가 거쳐가는 미들웨어 체인 (input 글리치용)
    ...기존 엔진 파일
  events/
    core/
      types.ts            # GameEvent, TriggerRule, EventContext, EventModule
      director.ts         # 우선순위·쿨다운·동시실행·강도 곡선
      registry.ts         # 모든 이벤트 등록 (한 줄씩)
      rng.ts              # 시드 기반 난수
    triggers/
      chance.ts
      condition.ts
      idle.ts
      pity.ts
      shape/
        closedLoop.ts
        grid.ts
        trend.ts
    glitches/
      inkBleed/           # render 글리치 (1순위 구현)
      colorBetrayal/      # data 글리치
      runawayEraser/      # ui 글리치
    memes/
      shared/
        MemeOverlay.tsx   # 밈 공통 등장/퇴장 레이어
      cat/
      dog/
      frog/
      agents/
      stonks/
    minigames/
      shared/
        MiniGameHost.tsx  # 노트 일시정지, 모달 레이어, 결과 반영
        lifecycle.ts      # enter → play → result → exit
      omok/
      sports/
      tycoon/
  dev/
    EventDebugPanel.tsx   # 개발용: 이벤트 강제 발동, 시드 고정, 카테고리 on/off
public/
  events/                 # 이미지·사운드 에셋 (카테고리/이벤트별 폴더)
```

### 5-1. 이벤트 폴더 내부 규칙 (이벤트 하나 = 폴더 하나)

```
omok/
  index.ts       # GameEvent 정의 (트리거, 우선순위, 쿨다운, load)
  OmokGame.tsx   # 연출/UI (React)
  logic.ts       # 판정 등 순수 로직 (React 의존 금지, 테스트 대상)
  logic.test.ts
```

- 새 이벤트 추가 시 **해당 폴더 생성 + `registry.ts`에 한 줄 추가** 외에 다른 파일을 수정하지 않는다.

---

## 6. 저작권 규칙 (필수)

배포되는 웹게임이므로 실존 IP를 그대로 쓰지 않는다.

- **페페(Pepe the Frog)**: 원작자가 저작권을 보유하고 무단 사용에 법적 대응한 이력이 있다 → **오리지널 개구리 캐릭터**로 대체.
- **맨인블랙**: 영화 IP → **"검은 정장 요원들이 섬광으로 기억을 지우는" 상황만 차용**한 오리지널 연출. 영화 제목, 로고, 배우 얼굴, 영화 장면 사용 금지.
- 고양이·강아지·주식 차트도 **직접 그린 오리지널 그래픽**만 사용. 인터넷 짤 이미지 파일을 그대로 넣지 않는다.
- 폴더/코드 이름도 일반명사 사용 (`frog`, `agents`, `stonks`).

---

## 7. 핵심 타입

```ts
// src/canvas/engine/hooks.ts
export type EngineHooks = {
  "stroke:start": { stroke: Stroke };
  "stroke:point": { point: Point };
  "stroke:commit": { stroke: Stroke; all: Stroke[] };
  "erase": { removed: Stroke[] };
  "tool:change": { tool: Tool };
  "history:undo": {};
  "history:redo": {};
};
export type EngineHookName = keyof EngineHooks;
```

```ts
// src/events/core/types.ts
export type EventCategory = "glitch" | "meme" | "minigame";
export type GlitchKind = "input" | "data" | "render" | "ui";

export type TriggerRule =
  | { kind: "chance"; on: EngineHookName; p: number }
  | { kind: "condition"; on: EngineHookName; when: (ctx: EventContext) => boolean }
  | { kind: "shape"; detector: ShapeDetector; minConfidence: number }
  | { kind: "idle"; ms: number }
  | { kind: "pity"; afterStrokes: number };

export type ShapeDetector = (strokes: Stroke[]) => number; // confidence 0~1

export interface GameEvent {
  id: string;
  category: EventCategory;
  glitchKind?: GlitchKind;        // category === "glitch"일 때만
  triggers: TriggerRule[];        // 하나라도 맞으면 발동 후보
  priority: number;               // 같은 시점 후보끼리 비교
  cooldownMs: number;
  unlockAt?: number;              // 이 intensity 이상에서만 등장
  load: () => Promise<EventModule>; // 동적 import (번들 분리)
}

export interface EventContext {
  strokes: Readonly<Stroke[]>;
  intensity: number;
  rng: Rng;
  now: number;
  // 엔진 조작 API (허용된 것만 노출)
  addStrokes(strokes: Stroke[]): void;
  updateStroke(id: string, patch: Partial<Stroke>): void;
  pauseInput(): void;
  resumeInput(): void;
}

export interface EventModule {
  run(ctx: EventContext): EventHandle | Promise<EventHandle>;
}

export interface EventHandle {
  durationMs?: number;
  revert?(): void;                // render/ui 글리치, 밈의 정리
  result?: Promise<EventResult>;  // 미니게임 결과
}

export interface EventResult {
  outcome: "win" | "lose" | "draw" | "skip";
  strokesToAdd?: Stroke[];        // 노트에 남길 결과물
}
```

### 7-1. 설계 의도
- `load`를 **동적 import**로 둔다 → 이벤트가 실제로 터질 때만 코드/에셋을 내려받아 첫 로딩이 가볍다.
- 이벤트는 엔진 내부에 직접 접근하지 않고 `EventContext`가 노출한 API로만 조작한다.

---

## 8. 미니게임 생명주기

```
enter  : 디렉터가 발동 → pauseInput() → 현재 Stroke[] 스냅샷 → MiniGameHost가 모달 레이어 표시
play   : 게임 진행 (노트 캔버스 위 별도 레이어 또는 DOM)
result : EventResult 반환
exit   : strokesToAdd를 노트에 커밋 → resumeInput() → 모달 제거
```

- 결과를 **스트로크 데이터로 노트에 남기는 것**이 배드노트다운 장치다. (스트로크가 벡터이므로 `Stroke[]`에 추가만 하면 됨)
- 사용자가 미니게임을 닫을 수 있어야 한다 (`outcome: "skip"`). 강제로 갇히면 이탈한다.

---

## 9. 팀 결정 사항

| 결정 사항 | 선택지 | 추천(참고용) | 상태 |
|---|---|---|---|
| `data` 글리치·미니게임 결과를 Undo로 되돌릴 수 있나 | 허용 / 금지 / 이벤트별 옵션 | 히스토리에 커맨드로 기록 + 이벤트별 `undoable` 옵션 | ☐ 미정 |
| 이벤트 결과를 IndexedDB에 저장하나 | 영구 저장 / 새로고침 시 원복 | 영구 저장 (말썽도 노트의 일부) | ☐ 미정 |
| 강도 곡선 기준 | 시간 / 스트로크 수 / 둘 다 | 둘 다 (경과 시간 + 스트로크 수) | ☐ 미정 |
| 첫 무발동 구간 | 0초 / 1분 / 2분 | 1~2분 | ☐ 미정 |
| `tycoon` 의미 확인 | 타이쿤 장르 / 기타 | 30초 초미니 타이쿤 | ☐ 미정 |
| 사운드 사용 여부 | 있음 / 없음 / 토글 | 기본 끔 + 토글 | ☐ 미정 |

---

## 10. 구현 순서 (Claude Code 작업 단위)

엔진이 아직 완성 전이어도 **1단계는 지금 바로** 진행한다. 비어 있는 훅이라도 미리 심어두면 나중에 엔진을 다시 뜯지 않는다.

1. **엔진 훅 심기**: `hooks.ts`, `inputPipeline.ts` 작성 후 엔진의 해당 지점에서 emit
2. **코어**: `types.ts`, `rng.ts`, `registry.ts`, `director.ts` (+ 디렉터 규칙 단위 테스트)
3. **트리거**: `chance`, `condition`, `idle`, `pity` → 이후 `shape/` 3종 (+ 단위 테스트)
4. **개발 도구**: `EventDebugPanel.tsx` (강제 발동, 시드 고정) — 이후 모든 이벤트 확인에 사용
5. **첫 이벤트 3종 (난이도 순)**
   - 글리치: `inkBleed` (render)
   - 밈: `cat` (chance 트리거)
   - 미니게임: `omok` (`grid` shape 트리거) + `MiniGameHost`
6. 나머지 밈·미니게임 순차 추가

### 체크리스트
- [ ] `hooks.ts` / `inputPipeline.ts`
- [ ] `events/core/*`
- [ ] 트리거 5종 + shape 인식기 3종
- [ ] `EventDebugPanel.tsx`
- [ ] `inkBleed` 글리치
- [ ] `cat` 밈 + `MemeOverlay`
- [ ] `omok` 미니게임 + `MiniGameHost`
- [ ] 나머지: `dog`, `frog`, `agents`, `stonks`, `sports`, `tycoon`, `colorBetrayal`, `runawayEraser`

---

## 11. 코딩 규칙 (이벤트 전용)

- 판정/인식 로직은 `logic.ts`, `triggers/shape/*`에 **순수 함수**로 두고 React를 import하지 않는다.
- `Math.random()` 금지 → `ctx.rng` 사용.
- 이벤트가 엔진 내부 상태를 직접 import/수정하지 않는다 → `EventContext` API만 사용.
- 에셋은 `public/events/<category>/<id>/`에 둔다.
- 브랜치: `feature/event-<id>` (예: `feature/event-omok`)
- 커밋 접두사는 기존 규칙(`feat:`, `fix:`, `perf:`, `chore:`) 유지.

---

## 12. Claude Code에 던질 첫 프롬프트 예시

```
CLAUDE.md, DRAWING_SPEC.md, EVENTS_SPEC.md를 읽고
EVENTS_SPEC.md 10장의 1~2단계부터 진행해줘.
엔진에 hooks.ts와 inputPipeline.ts를 심고,
events/core의 types.ts, rng.ts, registry.ts, director.ts를 만든 뒤
디렉터 규칙(4장)에 대한 단위 테스트까지 작성해줘.
이벤트 자체는 아직 만들지 말고, 끝나면 변경 파일 목록을 알려줘.
```
