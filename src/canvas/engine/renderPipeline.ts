// render 글리치용 엔진 훅: 오브젝트의 "데이터"는 전혀 건드리지 않고 "그리는 방식"만
// 바꾸는 통로다 (EVENTS_SPEC.md 2-1장 — 잉크 번짐, 화면 흔들림 등). inputPipeline.ts가
// 입력 좌표를 가로채는 통로라면, 이건 렌더링 시점에 일시적인 시각 효과를 끼워 넣는
// 통로다. 오버라이드가 없으면 평소처럼 그대로 그려지므로 이벤트 시스템이 없어도 엔진
// 동작에 영향이 없다.

export type RenderOverride = {
  filter?: string; // CanvasRenderingContext2D.filter 문자열 (예: "blur(2.5px)")
  globalAlpha?: number;
};

class RenderOverrideRegistry {
  private overrides = new Map<string, RenderOverride>();

  set(objectId: string, override: RenderOverride): void {
    this.overrides.set(objectId, override);
  }

  clear(objectId: string): void {
    this.overrides.delete(objectId);
  }

  get(objectId: string): RenderOverride | undefined {
    return this.overrides.get(objectId);
  }

  clearAll(): void {
    this.overrides.clear();
  }
}

export const renderOverrides = new RenderOverrideRegistry();
