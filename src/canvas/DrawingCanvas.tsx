import { useEffect, useRef, useState } from "react";
import { normalizePointerEvent } from "./engine/pointerInput";
import {
  createStroke,
  redrawAll,
  renderStrokeSegment,
  type Stroke,
} from "./engine/strokeEngine";

const DEFAULT_COLOR = "#1a1a1a";
const DEFAULT_SIZE = 3;

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const [, setStrokeCount] = useState(0);

  // 고해상도(레티나) 대응: 캔버스 실제 픽셀 크기와 CSS 크기를 분리해서 스케일링.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctxRef.current = ctx;
      redrawAll(ctx, strokesRef.current, rect.width, rect.height);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // Pointer Events 통합 입력 처리 (mousedown/touchstart 등은 사용하지 않는다).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const point = normalizePointerEvent(e, canvas);
      const stroke = createStroke("pen", DEFAULT_COLOR, DEFAULT_SIZE);
      stroke.points.push(point);
      currentStrokeRef.current = stroke;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const stroke = currentStrokeRef.current;
      const ctx = ctxRef.current;
      if (!stroke || !ctx) return;

      const point = normalizePointerEvent(e, canvas);
      const prev = stroke.points[stroke.points.length - 1];
      stroke.points.push(point);
      renderStrokeSegment(ctx, stroke, prev, point);
    };

    const finishStroke = () => {
      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (!stroke || stroke.points.length < 2) return;

      strokesRef.current = [...strokesRef.current, stroke];
      setStrokeCount(strokesRef.current.length);
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", finishStroke);
    canvas.addEventListener("pointercancel", finishStroke);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", finishStroke);
      canvas.removeEventListener("pointercancel", finishStroke);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        touchAction: "none",
        background: "#fff",
      }}
    />
  );
}
