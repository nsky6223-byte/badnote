# BadNote — 프로젝트 컨텍스트 (AI 자동 로드 파일)

> 이 파일은 Claude Code가 세션 시작 시 자동으로 읽는 파일입니다. 리포지토리 루트에 두세요.
> 상세 기능 스펙은 `DRAWING_SPEC.md`를 함께 참고하세요.

## 프로젝트 한 줄 정의
배드노트(BadNote)는 굿노트처럼 보이지만 필기·드로잉 중 예측불가하게 오작동하는 캐주얼 웹게임이다.
**이번 스프린트(초기 프로토타입, 목표 4주)는 게임 전체가 아니라 "패드로 필기·드로잉하는 핵심 엔진" 하나만 완성하는 데 집중한다.** 오작동(글리치) 기능은 이 엔진이 안정된 뒤 다음 스프린트에서 얹는다.

## 이번 스프린트 범위 (Scope)
**포함**
- 펜/터치/마우스 입력 기반 드로잉 (Pointer Events 통합)
- 필압·기울기 반응 (스타일러스 지원)
- 스트로크 스무딩 (손떨림 보정)
- 지우개, 색상, 펜 굵기 툴
- Undo/Redo
- 로컬 저장 (서버 없이 브라우저에만)
- 반응형 레이아웃 (태블릿 우선, 모바일/데스크탑 대응)
- GitHub 연동 협업 + 배포 자동화

**제외 (다음 스프린트)**
- 말썽 메커니즘(글리치) 전체 — 텍스트 변형, 지우개 도망, 색상 배신 등은 엔진 완성 후 훅(hook)으로 추가
- 계정 시스템, 서버/DB, 결제, 랭킹/리더보드
- 다국어, 모바일 앱

## 기술 스택 (확정)
| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | React + TypeScript + Vite | 빠른 HMR, 바이브 코딩에 적합 |
| 드로잉 렌더링 | Canvas API (2D context) | 오작동 훅을 걸기 쉬움 |
| 스트로크 스무딩 | `perfect-freehand` (npm) | 필압 기반 자연스러운 선, 의존성 가벼움 |
| 로컬 저장 | IndexedDB (`idb` 라이브러리) | 서버 없이 브라우저에 노트 저장 |
| 배포 | Vercel (GitHub 연동) | push 시 자동 배포, PR마다 프리뷰 URL |
| 협업 | GitHub (main + feature/* 브랜치) | 2~4인 팀 기준 |
| 서버/DB | **없음 (이번 스프린트는 불필요)** | 계정/랭킹 필요해지는 Phase 3부터 Supabase 검토 |

## 코딩 컨벤션
- 컴포넌트: 함수형 + TypeScript, `PascalCase.tsx`
- 드로잉 로직은 UI 컴포넌트와 분리 — `src/canvas/engine/` 아래 순수 로직만 (테스트·재사용 쉽게)
- 스트로크 데이터는 항상 벡터(포인트 배열) 형태로 보관 — 나중에 글리치 효과가 이 데이터를 조작해야 하므로 **픽셀이 아닌 오브젝트 단위**로 관리
- 커밋 메시지: `feat:`, `fix:`, `perf:`, `chore:` 접두사
- 브랜치: `feature/<기능명>` → PR → `main` 머지 (머지 시 Vercel 자동 배포)

## 폴더 구조 (제안)
```
src/
  canvas/
    DrawingCanvas.tsx        # 캔버스 렌더링 + 입력 이벤트 바인딩
    engine/
      pointerInput.ts        # 포인터 이벤트 정규화 (pen/touch/mouse)
      strokeEngine.ts        # 스트로크 생성/렌더링 (perfect-freehand 연동)
      smoothing.ts           # 보간/스무딩 로직
      layers.ts              # 레이어 관리 (배경/잉크/활성스트로크/UI)
      undoRedo.ts             # 히스토리 스택
      persistence.ts          # IndexedDB 저장/불러오기
  components/
    Toolbar.tsx               # 펜/지우개/색상/굵기 선택 UI
    ColorPicker.tsx
  App.tsx
  main.tsx
docs/
  DRAWING_SPEC.md
CLAUDE.md
```

## 참고 문서
- 드로잉 기능 상세 스펙, 결정사항 분담표, 4주 마일스톤: `DRAWING_SPEC.md`
