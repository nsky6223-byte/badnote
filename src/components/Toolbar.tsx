import "./Toolbar.css";
import type { DrawSettings } from "../settings";
import type {
  EraserMode,
  EraserSizeLevel,
  PenType,
  ToolKind,
} from "../canvas/engine/strokeEngine";

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

const TOOL_LABELS: Record<ToolKind, string> = {
  pen: "펜",
  highlighter: "형광펜",
  shape: "도형",
  lasso: "올가미",
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

type Props = {
  settings: DrawSettings;
  onChange: (patch: Partial<DrawSettings>) => void;
  hasSelection: boolean;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRecolor: (color: string) => void;
};

export default function Toolbar({
  settings,
  onChange,
  hasSelection,
  onCopy,
  onCut,
  onDelete,
  onDuplicate,
  onRecolor,
}: Props) {
  const { tool } = settings;

  return (
    <div className="toolbar">
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

      {tool === "lasso" && !hasSelection && (
        <span className="toolbar-hint">영역을 드래그해서 선택하세요</span>
      )}

      {tool === "lasso" && hasSelection && (
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
          </div>

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
