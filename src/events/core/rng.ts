// 시드 기반 난수. EVENTS_SPEC.md 4-6: "모든 랜덤은 rng.ts를 거친다. Math.random() 직접
// 사용 금지" — 같은 시드로 같은 세션을 재현할 수 있어야 버그(그리고 이벤트 밸런스)를
// 재현하고 디버깅할 수 있기 때문이다.

export type Rng = {
  next(): number; // 0 이상 1 미만
  int(maxExclusive: number): number; // 0 이상 maxExclusive 미만 정수
  pick<T>(items: readonly T[]): T;
  chance(p: number): boolean; // p 확률로 true (0~1)
};

// mulberry32 — 코드 몇 줄로 충분하고 32비트 정수만 쓰는 빠른 PRNG.
// 암호학적 품질은 필요 없고(이벤트 연출용) 결정론적 재현성만 중요하다.
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int(maxExclusive) {
      return Math.floor(next() * maxExclusive);
    },
    pick(items) {
      if (items.length === 0) throw new Error("빈 배열에서는 pick할 수 없습니다.");
      return items[rng.int(items.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
  return rng;
}
