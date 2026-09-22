import type { EraserMode, EraserSizeLevel, PenType, ToolKind } from "./canvas/engine/strokeEngine";

export type DrawSettings = {
  tool: ToolKind;
  penType: PenType;
  penColor: string;
  penSize: number;
  sharpness: number;
  highlighterColor: string;
  highlighterSize: number;
  eraserMode: EraserMode;
  eraserLevel: EraserSizeLevel;
};

export const DEFAULT_SETTINGS: DrawSettings = {
  tool: "pen",
  penType: "ballpoint",
  penColor: "#1a1a1a",
  penSize: 4,
  sharpness: 50,
  highlighterColor: "#ffe066",
  highlighterSize: 14,
  eraserMode: "normal",
  eraserLevel: "md",
};
