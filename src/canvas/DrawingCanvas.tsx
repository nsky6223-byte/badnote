import { useEffect, useRef } from "react";
import { normalizePointerEvent, type PointerKind } from "./engine/pointerInput";
import {
  createStroke,
  hitTestStroke,
  redrawAll,
  renderStroke,
  type Stroke,
  type Tool,
} from "./engine/strokeEngine";

type Props = {
  tool: Tool;
  color: string;
  penSize: number;
  eraserSize: number;
};

export default function DrawingCanvas({ tool, color, penSize, eraserSize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 잉크 레이어(확정된 스트로크) / 활성 레이어(지금 그리는 중인 스트로크) 분리 — pointermove마다
  // 전체를 다시 계산해야 하는 perfect-freehand 특성상 성능을 위해 필수.
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const activeCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  // 팜 리젝션: pen이 눌려있는 동안 들어오는 touch 포인터는 무시한다.
  const activePenIdRef = useRef<number | null>(null);

  // 이벤트 핸들러(마운트 시 한 번만 등록되는 클로저)가 최신 툴바 값을 읽을 수 있도록 ref로 미러링.
  const toolRef = useRef(tool);
  const colorRef = useRef(color);
  const penSizeRef = useRef(penSize);
  const eraserSizeRef = useRef(eraserSize);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    penSizeRef.current = penSize;
  }, [penSize]);
  useEffect(() => {
    eraserSizeRef.current = eraserSize;
  }, [eraserSize]);

  const pendingFrameRef = useRef(false);
  const scheduleFrame = (draw: () => void) => {
    if (pendingFrameRef.current) return;
    pendingFrameRef.current = true;
    requestAnimationFrame(() => {
      pendingFrameRef.current = false;
      draw();
    });
  };

  const redrawInk = () => {
    const ctx = inkCtxRef.current;
    if (!ctx) return;
    redrawAll(ctx, strokesRef.current, sizeRef.current.width, sizeRef.current.height);
  };

  const redrawActive = () => {
    const ctx = activeCtxRef.current;
    const stroke = currentStrokeRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    if (stroke) renderStroke(ctx, stroke);
  };

  // 캔버스 크기 대응: ResizeObserver + devicePixelRatio 스케일링.
  useEffect(() => {
    const container = containerRef.current;
    const ink = inkCanvasRef.current;
    const active = activeCanvasRef.current;
    if (!container || !ink || !active) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };

      for (const canvas of [ink, active]) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      const inkCtx = ink.getContext("2d");
      const activeCtx = active.getContext("2d");
      if (!inkCtx || !activeCtx) return;
      inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      inkCtxRef.current = inkCtx;
      activeCtxRef.current = activeCtx;

      redrawInk();
      redrawActive();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Pointer Events 통합 입력 처리 (mousedown/touchstart 등은 사용하지 않는다).
  useEffect(() => {
    const active = activeCanvasRef.current;
    if (!active) return;

    const eraseAt = (x: number, y: number) => {
      const radius = eraserSizeRef.current;
      const before = strokesRef.current.length;
      strokesRef.current = strokesRef.current.filter(
        (s) => !hitTestStroke(s, x, y, radius),
      );
      if (strokesRef.current.length !== before) redrawInk();
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" && activePenIdRef.current !== null) {
        // 펜 사용 중 발생한 손바닥 등의 터치는 무시한다.
        e.preventDefault();
        return;
      }
      if (e.pointerType === "pen") {
        activePenIdRef.current = e.pointerId;
      }

      active.setPointerCapture(e.pointerId);
      const point = normalizePointerEvent(e, active);

      if (toolRef.current === "eraser") {
        eraseAt(point.x, point.y);
        return;
      }

      const stroke = createStroke(
        "pen",
        colorRef.current,
        penSizeRef.current,
        e.pointerType as PointerKind,
      );
      stroke.points.push(point);
      currentStrokeRef.current = stroke;
      scheduleFrame(redrawActive);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && activePenIdRef.current !== null) return;

      const point = normalizePointerEvent(e, active);

      if (toolRef.current === "eraser") {
        if (e.buttons === 0) return; // 눌리지 않은 채 지나가는 hover는 무시.
        eraseAt(point.x, point.y);
        return;
      }

      const stroke = currentStrokeRef.current;
      if (!stroke) return;
      stroke.points.push(point);
      scheduleFrame(redrawActive);
    };

    const finishStroke = (e: PointerEvent) => {
      if (e.pointerType === "pen" && activePenIdRef.current === e.pointerId) {
        activePenIdRef.current = null;
      }

      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (!stroke || stroke.points.length === 0) return;

      strokesRef.current = [...strokesRef.current, stroke];
      redrawInk();
      activeCtxRef.current?.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    };

    active.addEventListener("pointerdown", handlePointerDown);
    active.addEventListener("pointermove", handlePointerMove);
    active.addEventListener("pointerup", finishStroke);
    active.addEventListener("pointercancel", finishStroke);

    return () => {
      active.removeEventListener("pointerdown", handlePointerDown);
      active.removeEventListener("pointermove", handlePointerMove);
      active.removeEventListener("pointerup", finishStroke);
      active.removeEventListener("pointercancel", finishStroke);
    };
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={inkCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: "#fff",
        }}
      />
      <canvas
        ref={activeCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          touchAction: "none",
        }}
      />
    </div>
  );
}
