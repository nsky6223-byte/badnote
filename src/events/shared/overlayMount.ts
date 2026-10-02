// 밈/미니게임을 화면에 띄우는 작은 헬퍼. 엔진(App.tsx/DrawingCanvas.tsx)에 전용 레이어를
// 만들어두지 않고, 이벤트가 필요할 때 자기 컨테이너를 document.body에 직접 붙였다 뗀다 —
// 그래서 "엔진은 이벤트의 존재를 모른다"는 원칙이 그대로 유지된다.
//
// 밈은 필기를 막지 않아야 하므로 기본은 pointer-events: none (EVENTS_SPEC.md 2장),
// 미니게임처럼 클릭이 필요한 경우만 interactive: true로 켠다.

import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

export function mountOverlay(node: ReactNode, options?: { interactive?: boolean }): () => void {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.inset = "0";
  container.style.pointerEvents = options?.interactive ? "auto" : "none";
  container.style.zIndex = "50";
  container.style.overflow = "hidden";
  document.body.appendChild(container);

  const root: Root = createRoot(container);
  root.render(node);

  let unmounted = false;
  return () => {
    if (unmounted) return;
    unmounted = true;
    root.unmount();
    container.remove();
  };
}
