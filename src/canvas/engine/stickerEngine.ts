// 스티커 오브젝트. 우선 포스트잇 2종(흰색/노란 줄글)만 지원하고, 나중에 디자인을
// 더 추가할 때는 STICKER_PALETTE에 항목만 늘리면 된다.

export type StickerKind = "postit-white" | "postit-yellow";

export type StickerObject = {
  id: string;
  objectType: "sticker";
  stickerKind: StickerKind;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_SIZE = 160;

const STICKER_PALETTE: Record<StickerKind, { bg: string; line: string; shadow: string }> = {
  "postit-white": { bg: "#ffffff", line: "#d7dbe0", shadow: "rgba(0,0,0,0.18)" },
  "postit-yellow": { bg: "#fff3a0", line: "#e0c84a", shadow: "rgba(0,0,0,0.18)" },
};

export function createStickerObject(kind: StickerKind, centerX: number, centerY: number): StickerObject {
  return {
    id: crypto.randomUUID(),
    objectType: "sticker",
    stickerKind: kind,
    x: centerX - DEFAULT_SIZE / 2,
    y: centerY - DEFAULT_SIZE / 2,
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
  };
}

export function renderSticker(ctx: CanvasRenderingContext2D, obj: StickerObject) {
  const palette = STICKER_PALETTE[obj.stickerKind];

  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
  ctx.restore();

  ctx.strokeStyle = palette.line;
  ctx.lineWidth = 1;
  const lineGap = Math.max(16, obj.height / 7);
  for (let ly = obj.y + lineGap; ly < obj.y + obj.height - 6; ly += lineGap) {
    ctx.beginPath();
    ctx.moveTo(obj.x + 10, ly);
    ctx.lineTo(obj.x + obj.width - 10, ly);
    ctx.stroke();
  }
}
