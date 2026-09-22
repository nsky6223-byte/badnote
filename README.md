# badnote

배드노트웹 — 굿노트처럼 보이지만 필기·드로잉 중 예측불가하게 오작동하는 캐주얼 웹게임.

현재 스프린트는 게임 전체가 아니라 패드로 필기·드로잉하는 핵심 엔진 하나만 완성하는 데 집중합니다.
자세한 내용은 [CLAUDE.md](./CLAUDE.md), [DRAWING_SPEC.md](./DRAWING_SPEC.md) 참고.

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (tsc -b && vite build)
npm run lint      # oxlint
```

## 스택

Vite + React + TypeScript, Canvas API, perfect-freehand, IndexedDB(`idb`), Vercel 배포.
