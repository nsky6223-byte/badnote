// 개발용 패널: 이벤트 강제 발동, 시드 고정, 카테고리 on/off (EVENTS_SPEC.md 10장 4단계).
// 실제 서비스에 노출할 UI가 아니라 개발 중에 눈으로 결과를 확인하기 위한 도구다.

import { useState } from "react";
import { getAllEvents } from "../events/core/registry";
import { eventRuntime } from "../events/core/runtime";
import type { EventCategory } from "../events/core/types";
import "./EventDebugPanel.css";

const CATEGORIES: EventCategory[] = ["glitch", "meme", "minigame"];
const CATEGORY_LABELS: Record<EventCategory, string> = {
  glitch: "글리치",
  meme: "밈",
  minigame: "미니게임",
};

export default function EventDebugPanel() {
  const [open, setOpen] = useState(false);
  const [categoryEnabled, setCategoryEnabled] = useState<Record<EventCategory, boolean>>({
    glitch: true,
    meme: true,
    minigame: true,
  });
  const [seedInput, setSeedInput] = useState("1234");

  const toggleCategory = (category: EventCategory) => {
    const next = !categoryEnabled[category];
    eventRuntime.setCategoryEnabled(category, next);
    setCategoryEnabled((prev) => ({ ...prev, [category]: next }));
  };

  const applySeed = () => {
    const seed = Number(seedInput);
    if (Number.isFinite(seed)) eventRuntime.setSeed(seed);
  };

  if (!open) {
    return (
      <button
        type="button"
        className="event-debug-toggle"
        onClick={() => setOpen(true)}
        aria-label="이벤트 디버그 패널 열기"
      >
        🛠
      </button>
    );
  }

  return (
    <div className="event-debug-panel">
      <div className="event-debug-panel__header">
        <span>이벤트 디버그</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="닫기">
          ×
        </button>
      </div>

      <div className="event-debug-panel__section">
        <span className="event-debug-panel__label">카테고리 on/off</span>
        <div className="event-debug-panel__row">
          {CATEGORIES.map((category) => (
            <label key={category} className="event-debug-panel__checkbox">
              <input
                type="checkbox"
                checked={categoryEnabled[category]}
                onChange={() => toggleCategory(category)}
              />
              {CATEGORY_LABELS[category]}
            </label>
          ))}
        </div>
      </div>

      <div className="event-debug-panel__section">
        <span className="event-debug-panel__label">시드 고정</span>
        <div className="event-debug-panel__row">
          <input
            type="number"
            className="event-debug-panel__seed-input"
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
          />
          <button type="button" onClick={applySeed}>
            적용
          </button>
        </div>
      </div>

      <div className="event-debug-panel__section">
        <span className="event-debug-panel__label">강제 발동</span>
        <div className="event-debug-panel__row event-debug-panel__row--wrap">
          {getAllEvents().map((event) => (
            <button
              key={event.id}
              type="button"
              className="event-debug-panel__force-btn"
              onClick={() => eventRuntime.forceFire(event.id)}
            >
              {event.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
