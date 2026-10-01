import type { EraserMode, EraserSizeLevel, PenType, ToolKind } from "./canvas/engine/strokeEngine";
import type { StickerKind } from "./canvas/engine/stickerEngine";

export type DrawSettings = {
  tool: ToolKind;
  penType: PenType;
  penColor: string;
  penSize: number;
  sharpness: number;
  highlighterColor: string;
  highlighterSize: number;
  shapeColor: string;
  shapeStrokeWidth: number;
  eraserMode: EraserMode;
  eraserLevel: EraserSizeLevel;
  stickerKind: StickerKind;
  textColor: string;
  textFontSize: number;
  laserColor: string;
};

export const DEFAULT_SETTINGS: DrawSettings = {
  tool: "pen",
  penType: "ballpoint",
  penColor: "#1a1a1a",
  penSize: 4,
  sharpness: 50,
  highlighterColor: "#ffe066",
  highlighterSize: 14,
  shapeColor: "#1a1a1a",
  shapeStrokeWidth: 3,
  eraserMode: "normal",
  eraserLevel: "md",
  stickerKind: "postit-yellow",
  textColor: "#1a1a1a",
  textFontSize: 20,
  laserColor: "#ff3b30",
};
