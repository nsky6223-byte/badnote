// 미니게임 공통 모달 레이어. 노트를 흐리게 가리고 가운데에 게임을 띄운다.
// 사용자가 언제든 닫을 수 있어야 한다는 EVENTS_SPEC.md 8장 원칙("강제로 갇히면
// 이탈한다")을 지키기 위해 닫기 버튼은 항상 보여준다.

import type { ReactNode } from "react";
import "./MiniGameHost.css";

type Props = {
  title: string;
  onSkip: () => void;
  children: ReactNode;
};

export default function MiniGameHost({ title, onSkip, children }: Props) {
  return (
    <div className="minigame-host">
      <div className="minigame-host__panel">
        <div className="minigame-host__header">
          <span className="minigame-host__title">{title}</span>
          <button type="button" className="minigame-host__close" onClick={onSkip} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="minigame-host__body">{children}</div>
      </div>
    </div>
  );
}
