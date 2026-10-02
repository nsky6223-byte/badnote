// 밈 공통 등장/퇴장 레이어. 각 밈(cat, dog, ...)은 이 안에 자기 캐릭터만 넣으면 되고,
// 페이드 인/아웃과 정리 타이밍은 여기서 한 번만 관리한다.

import { useEffect, useState, type ReactNode } from "react";
import "./MemeOverlay.css";

const EXIT_ANIMATION_MS = 300;

type Props = {
  children: ReactNode;
  durationMs: number;
  onDone: () => void;
};

export default function MemeOverlay({ children, durationMs, onDone }: Props) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");

  useEffect(() => {
    const toVisible = window.setTimeout(() => setPhase("visible"), 30);
    const toExit = window.setTimeout(
      () => setPhase("exit"),
      Math.max(0, durationMs - EXIT_ANIMATION_MS),
    );
    const toDone = window.setTimeout(onDone, durationMs);
    return () => {
      window.clearTimeout(toVisible);
      window.clearTimeout(toExit);
      window.clearTimeout(toDone);
    };
  }, [durationMs, onDone]);

  return <div className={`meme-overlay meme-overlay--${phase}`}>{children}</div>;
}
