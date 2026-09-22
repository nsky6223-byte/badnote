import "./Toolbar.css";
import type { Tool } from "../canvas/engine/strokeEngine";

const PALETTE = [
  "#1a1a1a",
  "#e03131",
  "#f76707",
  "#ffd43b",
  "#2f9e44",
  "#1971c2",
  "#7048e8",
  "#868e96",
];

type Props = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  color: string;
  onColorChange: (color: string) => void;
  penSize: number;
  onPenSizeChange: (size: number) => void;
  eraserSize: number;
  onEraserSizeChange: (size: number) => void;
};

export default function Toolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  penSize,
  onPenSizeChange,
  eraserSize,
  onEraserSizeChange,
}: Props) {
  const isPen = tool === "pen";

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          type="button"
          className={`tool-btn ${isPen ? "active" : ""}`}
          onClick={() => onToolChange("pen")}
          aria-pressed={isPen}
        >
          펜
        </button>
        <button
          type="button"
          className={`tool-btn ${!isPen ? "active" : ""}`}
          onClick={() => onToolChange("eraser")}
          aria-pressed={!isPen}
        >
          지우개
        </button>
      </div>

      {isPen && (
        <div className="toolbar-group">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-swatch ${color === c ? "active" : ""}`}
              style={{ background: c }}
              onClick={() => onColorChange(c)}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            className="color-picker"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            aria-label="커스텀 색상"
          />
        </div>
      )}

      <div className="toolbar-group size-group">
        <label htmlFor="size-slider">{isPen ? "펜 굵기" : "지우개 크기"}</label>
        <input
          id="size-slider"
          type="range"
          min={isPen ? 1 : 8}
          max={isPen ? 24 : 60}
          value={isPen ? penSize : eraserSize}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (isPen) onPenSizeChange(value);
            else onEraserSizeChange(value);
          }}
        />
      </div>
    </div>
  );
}
