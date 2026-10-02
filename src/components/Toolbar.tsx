import { useRef } from "react";
import "./Toolbar.css";
import type { HistoryInfo, SelectionInfo } from "../canvas/DrawingCanvas";
import type {
  EraserMode,
  EraserSizeLevel,
  PenType,
  ToolKind,
} from "../canvas/engine/strokeEngine";
import type { StickerKind } from "../canvas/engine/stickerEngine";
import type { DrawSettings } from "../settings";

const PEN_PALETTE = [
  "#1a1a1a",
  "#e03131",
  "#f76707",
  "#ffd43b",
  "#2f9e44",
  "#1971c2",
  "#7048e8",
  "#868e96",
];

const HIGHLIGHTER_PALETTE = ["#ffe066", "#8ce99a", "#ffa8a8", "#74c0fc", "#ffd8a8"];
const LASER_PALETTE = ["#ff3b30", "#30d158", "#0a84ff"];

const TOOL_LABELS: Record<ToolKind, string> = {
  pen: "펜",
  highlighter: "형광펜",
  shape: "도형",
  lasso: "올가미",
  sticker: "스티커",
  image: "이미지",
  text: "텍스트",
  laser: "레이저",
  eraser: "지우개",
};

const PEN_TYPE_LABELS: Record<PenType, string> = {
  fountain: "만년필",
  ballpoint: "볼펜",
  brush: "화필",
};

const ERASER_MODE_LABELS: Record<EraserMode, string> = {
  normal: "일반 지우개",
  stroke: "획 지우개",
};

const ERASER_LEVEL_LABELS: Record<EraserSizeLevel, string> = {
  sm: "소",
  md: "중",
  lg: "대",
};

const STICKER_LABELS: Record<StickerKind, string> = {
  "postit-white": "흰색 줄글",
  "postit-yellow": "노란 줄글",
};

type Props = {
  settings: DrawSettings;
  onChange: (patch: Partial<DrawSettings>) => void;
  selection: SelectionInfo;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRecolor: (color: string) => void;
  onToggleCrop: () => void;
  onAddImage: (file: File) => void;
  history: HistoryInfo;
  onUndo: () => void;
  onRedo: () => void;
};

export default function Toolbar({
  settings,
  onChange,
  selection,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onRecolor,
  onToggleCrop,
  onAddImage,
  history,
  onUndo,
  onRedo,
}: Props) {
  const { tool } = settings;
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button type="button" className="tool-btn" onClick={onUndo} disabled={!history.canUndo}>
          실행취소
        </button>
        <button type="button" className="tool-btn" onClick={onRedo} disabled={!history.canRedo}>
          다시실행
        </button>
      </div>

      <div className="toolbar-group">
        {(Object.keys(TOOL_LABELS) as ToolKind[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tool-btn ${tool === t ? "active" : ""}`}
            onClick={() => onChange({ tool: t })}
            aria-pressed={tool === t}
          >
            {TOOL_LABELS[t]}
          </button>
        ))}
      </div>

      {tool === "pen" && (
        <>
          <div className="toolbar-group">
            {(Object.keys(PEN_TYPE_LABELS) as PenType[]).map((pt) => (
              <button
                key={pt}
                type="button"
                className={`tool-btn ${settings.penType === pt ? "active" : ""}`}
                onClick={() => onChange({ penType: pt })}
                aria-pressed={settings.penType === pt}
              >
                {PEN_TYPE_LABELS[pt]}
              </button>
            ))}
          </div>

          <div className="toolbar-group">
            {PEN_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${settings.penColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ penColor: c })}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="color-picker"
              value={settings.penColor}
              onChange={(e) => onChange({ penColor: e.target.value })}
              aria-label="커스텀 색상"
            />
          </div>

          <div className="toolbar-group size-group">
            <label htmlFor="pen-size">펜 굵기</label>
            <input
              id="pen-size"
              type="range"
              min={1}
              max={24}
              value={settings.penSize}
              onChange={(e) => onChange({ penSize: Number(e.target.value) })}
            />
          </div>

          <div className="toolbar-group size-group">
            <label htmlFor="pen-sharpness">펜끝 선명도</label>
            <input
              id="pen-sharpness"
              type="range"
              min={0}
              max={100}
              value={settings.sharpness}
              onChange={(e) => onChange({ sharpness: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {tool === "highlighter" && (
        <>
          <div className="toolbar-group">
            {HIGHLIGHTER_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${settings.highlighterColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ highlighterColor: c })}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="color-picker"
              value={settings.highlighterColor}
              onChange={(e) => onChange({ highlighterColor: e.target.value })}
              aria-label="커스텀 색상"
            />
          </div>

          <div className="toolbar-group size-group">
            <label htmlFor="highlighter-size">형광펜 굵기</label>
            <input
              id="highlighter-size"
              type="range"
              min={6}
              max={30}
              value={settings.highlighterSize}
              onChange={(e) => onChange({ highlighterSize: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {tool === "shape" && (
        <>
          <div className="toolbar-group">
            {PEN_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${settings.shapeColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ shapeColor: c })}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="color-picker"
              value={settings.shapeColor}
              onChange={(e) => onChange({ shapeColor: e.target.value })}
              aria-label="커스텀 색상"
            />
          </div>

          <div className="toolbar-group size-group">
            <label htmlFor="shape-stroke-width">선 굵기</label>
            <input
              id="shape-stroke-width"
              type="range"
              min={1}
              max={16}
              value={settings.shapeStrokeWidth}
              onChange={(e) => onChange({ shapeStrokeWidth: Number(e.target.value) })}
            />
          </div>

          <span className="toolbar-hint">
            동그라미·네모·세모·별 모양을 닫힌 도형으로 그리면 자동으로 정리돼요
          </span>
        </>
      )}

      {tool === "sticker" && (
        <div className="toolbar-group">
          {(Object.keys(STICKER_LABELS) as StickerKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`tool-btn ${settings.stickerKind === kind ? "active" : ""}`}
              onClick={() => onChange({ stickerKind: kind })}
              aria-pressed={settings.stickerKind === kind}
            >
              {STICKER_LABELS[kind]}
            </button>
          ))}
          <span className="toolbar-hint">캔버스를 탭하면 붙여져요</span>
        </div>
      )}

      {tool === "image" && (
        <div className="toolbar-group">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="file-input-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddImage(file);
              e.target.value = "";
            }}
          />
          <button type="button" className="tool-btn" onClick={() => fileInputRef.current?.click()}>
            파일 선택
          </button>
          <span className="toolbar-hint">
            모바일은 앨범에서 선택돼요 · 컴퓨터는 드래그 앤 드롭도 가능해요
          </span>
        </div>
      )}

      {tool === "text" && (
        <>
          <div className="toolbar-group">
            {PEN_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch ${settings.textColor === c ? "active" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ textColor: c })}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              className="color-picker"
              value={settings.textColor}
              onChange={(e) => onChange({ textColor: e.target.value })}
              aria-label="커스텀 색상"
            />
          </div>

          <div className="toolbar-group size-group">
            <label htmlFor="text-font-size">글자 크기</label>
            <input
              id="text-font-size"
              type="range"
              min={10}
              max={48}
              value={settings.textFontSize}
              onChange={(e) => onChange({ textFontSize: Number(e.target.value) })}
            />
          </div>

          <span className="toolbar-hint">캔버스를 탭하고 입력하세요</span>
        </>
      )}

      {tool === "laser" && (
        <div className="toolbar-group">
          {LASER_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${settings.laserColor === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => onChange({ laserColor: c })}
              aria-label={c}
            />
          ))}
          <span className="toolbar-hint">누른 채로 움직이면 레이저가 표시되고 서서히 사라져요</span>
        </div>
      )}

      {tool === "lasso" && !selection.hasSelection && (
        <span className="toolbar-hint">영역을 드래그해서 선택하세요</span>
      )}

      {tool === "lasso" && selection.hasSelection && (
        <>
          <div className="toolbar-group">
            <button type="button" className="tool-btn" onClick={onCopy}>
              복사
            </button>
            <button type="button" className="tool-btn" onClick={onCut}>
              오려두기
            </button>
            <button type="button" className="tool-btn" onClick={onDuplicate}>
              복제
            </button>
            <button type="button" className="tool-btn" onClick={onDelete}>
              삭제
            </button>
            {selection.canCrop && (
              <button
                type="button"
                className={`tool-btn ${selection.cropActive ? "active" : ""}`}
                onClick={onToggleCrop}
              >
                {selection.cropActive ? "자르기 완료" : "자르기"}
              </button>
            )}
          </div>

          {selection.canRecolor && (
            <div className="toolbar-group">
              {PEN_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="color-swatch"
                  style={{ background: c }}
                  onClick={() => onRecolor(c)}
                  aria-label={c}
                />
              ))}
              <input
                type="color"
                className="color-picker"
                onChange={(e) => onRecolor(e.target.value)}
                aria-label="선택 항목 색상 변경"
              />
            </div>
          )}
        </>
      )}

      {tool === "eraser" && (
        <>
          <div className="toolbar-group">
            {(Object.keys(ERASER_MODE_LABELS) as EraserMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`tool-btn ${settings.eraserMode === mode ? "active" : ""}`}
                onClick={() => onChange({ eraserMode: mode })}
                aria-pressed={settings.eraserMode === mode}
              >
                {ERASER_MODE_LABELS[mode]}
              </button>
            ))}
          </div>

          <div className="toolbar-group">
            {(Object.keys(ERASER_LEVEL_LABELS) as EraserSizeLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`tool-btn ${settings.eraserLevel === level ? "active" : ""}`}
                onClick={() => onChange({ eraserLevel: level })}
                aria-pressed={settings.eraserLevel === level}
              >
                {ERASER_LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
