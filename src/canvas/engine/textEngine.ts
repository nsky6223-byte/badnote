// 텍스트 오브젝트. 입력 자체는 DOM <textarea>로 받는다 — 한글 IME 조합 입력은
// Canvas 위에서 직접 구현하기 사실상 불가능하므로, 편집 중에는 실제 textarea를
// 캔버스 위에 띄우고, 확정(blur)되면 그 내용을 이 오브젝트로 변환해 캔버스에 그린다.
// 줄바꿈(\n)은 그대로 반영하지만 자동 줄바꿈(word wrap)은 지원하지 않는다.

export type TextObject = {
  id: string;
  objectType: "text";
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  fontSize: number;
};

const LINE_HEIGHT_RATIO = 1.3;

function fontString(fontSize: number): string {
  return `${fontSize}px system-ui, "Segoe UI", sans-serif`;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d")!;
  }
  return measureCtx;
}

export function measureTextBlock(text: string, fontSize: number): { width: number; height: number } {
  const ctx = getMeasureCtx();
  ctx.font = fontString(fontSize);
  const lines = text.split("\n");
  const width = Math.max(10, ...lines.map((line) => ctx.measureText(line || " ").width));
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return { width, height: Math.max(lineHeight, lines.length * lineHeight) };
}

export function createTextObject(
  x: number,
  y: number,
  text: string,
  color: string,
  fontSize: number,
): TextObject {
  const { width, height } = measureTextBlock(text, fontSize);
  return { id: crypto.randomUUID(), objectType: "text", x, y, width, height, text, color, fontSize };
}

export function renderText(ctx: CanvasRenderingContext2D, obj: TextObject) {
  ctx.fillStyle = obj.color;
  ctx.font = fontString(obj.fontSize);
  ctx.textBaseline = "top";
  const lineHeight = obj.fontSize * LINE_HEIGHT_RATIO;
  const lines = obj.text.split("\n");
  lines.forEach((line, i) => {
    ctx.fillText(line, obj.x, obj.y + i * lineHeight);
  });
}
