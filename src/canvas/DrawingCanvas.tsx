import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { normalizePointerEvent, type PointerKind } from "./engine/pointerInput";
import {
  boundsFromPoints,
  classifyShape,
  createShapeObject,
  type Pt,
} from "./engine/shapeEngine";
import {
  createStroke,
  ERASER_RADIUS,
  erasePartial,
  type Stroke,
} from "./engine/strokeEngine";
import {
  duplicateObject,
  getBounds,
  hitTestObject,
  objectIntersectsLasso,
  pointInBounds,
  recolorObject,
  redrawObjects,
  renderObject,
  scaleObject,
  translateObject,
  unionBounds,
  type Bounds,
  type CanvasObject,
} from "./engine/objectOps";
import type { DrawSettings } from "../settings";

export type DrawingCanvasHandle = {
  copySelection: () => void;
  cutSelection: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  recolorSelection: (color: string) => void;
};

type Props = {
  settings: DrawSettings;
  onSelectionChange?: (hasSelection: boolean) => void;
};

const HANDLE_SIZE = 14;

function getHandleRect(bounds: Bounds): Bounds {
  return {
    x: bounds.x + bounds.width - HANDLE_SIZE / 2,
    y: bounds.y + bounds.height - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  };
}

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { settings, onSelectionChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  // 잉크(확정) / 활성(그리는 중·미리보기) / 선택(올가미·바운딩박스) 3개 레이어로 분리.
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const inkCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const activeCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const selectionCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const objectsRef = useRef<CanvasObject[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const shapeDraftRef = useRef<Pt[] | null>(null);
  const lassoDraftRef = useRef<Pt[] | null>(null);

  const selectedIdsRef = useRef<Set<string> | null>(null);
  const selectionBoundsRef = useRef<Bounds | null>(null);
  const dragModeRef = useRef<"none" | "move" | "resize">("none");
  const dragStartRef = useRef<Pt | null>(null);
  const dragOriginalObjectsRef = useRef<CanvasObject[] | null>(null);
  const dragOriginalBoundsRef = useRef<Bounds | null>(null);
  const previewObjectsRef = useRef<CanvasObject[] | null>(null);
  const previewBoundsRef = useRef<Bounds | null>(null);
  const pendingPreviewRef = useRef<CanvasObject[] | null>(null);
  const clipboardRef = useRef<CanvasObject[]>([]);

  const sizeRef = useRef({ width: 0, height: 0 });
  const lastPointerRef = useRef<Pt | null>(null);
  const activePenIdRef = useRef<number | null>(null);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

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
    redrawObjects(ctx, objectsRef.current, sizeRef.current.width, sizeRef.current.height);
  };

  const redrawActive = () => {
    const ctx = activeCtxRef.current;
    const stroke = currentStrokeRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    if (stroke) renderObject(ctx, stroke);
  };

  const clearActive = () => {
    activeCtxRef.current?.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
  };

  const clearSelectionLayer = () => {
    selectionCtxRef.current?.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
  };

  // 지우개 도구일 때 실제 지워지는 범위를 검은 원 테두리로 미리 보여준다.
  const drawEraserCursor = (x: number, y: number) => {
    const ctx = activeCtxRef.current;
    if (!ctx) return;
    const radius = ERASER_RADIUS[settingsRef.current.eraserLevel];
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  const drawSelectionOverlay = (bounds: Bounds) => {
    const ctx = selectionCtxRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    ctx.save();
    ctx.strokeStyle = "#1971c2";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);
    const handle = getHandleRect(bounds);
    ctx.fillStyle = "#1971c2";
    ctx.fillRect(handle.x, handle.y, handle.width, handle.height);
    ctx.restore();
  };

  const redrawShapeDraft = () => {
    const ctx = activeCtxRef.current;
    const draft = shapeDraftRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    if (!draft || draft.length < 2) return;
    ctx.strokeStyle = settingsRef.current.shapeColor;
    ctx.lineWidth = settingsRef.current.shapeStrokeWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(draft[0].x, draft[0].y);
    for (let i = 1; i < draft.length; i++) ctx.lineTo(draft[i].x, draft[i].y);
    ctx.stroke();
  };

  const redrawLassoDraft = () => {
    const ctx = selectionCtxRef.current;
    const draft = lassoDraftRef.current;
    if (!ctx) return;
    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    if (!draft || draft.length < 2) return;
    ctx.save();
    ctx.strokeStyle = "#1971c2";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(draft[0].x, draft[0].y);
    for (let i = 1; i < draft.length; i++) ctx.lineTo(draft[i].x, draft[i].y);
    ctx.stroke();
    ctx.restore();
  };

  const clearSelection = () => {
    if (!selectedIdsRef.current) return;
    selectedIdsRef.current = null;
    selectionBoundsRef.current = null;
    clearSelectionLayer();
    onSelectionChangeRef.current?.(false);
  };

  const snapshotSelected = (): CanvasObject[] => {
    const ids = selectedIdsRef.current;
    if (!ids) return [];
    return objectsRef.current.filter((o) => ids.has(o.id));
  };

  const renderSelectionPreview = (previewObjects: CanvasObject[]) => {
    const ids = selectedIdsRef.current;
    if (!ids) return;

    const inkCtx = inkCtxRef.current;
    if (inkCtx) {
      const visible = objectsRef.current.filter((o) => !ids.has(o.id));
      redrawObjects(inkCtx, visible, sizeRef.current.width, sizeRef.current.height);
    }

    const activeCtx = activeCtxRef.current;
    if (activeCtx) {
      activeCtx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
      for (const obj of previewObjects) renderObject(activeCtx, obj);
    }

    const bounds = unionBounds(previewObjects.map(getBounds));
    drawSelectionOverlay(bounds);
    previewObjectsRef.current = previewObjects;
    previewBoundsRef.current = bounds;
  };

  const commitSelectionTransform = () => {
    const ids = selectedIdsRef.current;
    const preview = previewObjectsRef.current;
    dragModeRef.current = "none";
    dragStartRef.current = null;
    dragOriginalObjectsRef.current = null;
    dragOriginalBoundsRef.current = null;
    pendingPreviewRef.current = null;

    if (!ids || !preview) return;

    objectsRef.current = objectsRef.current.filter((o) => !ids.has(o.id)).concat(preview);
    selectionBoundsRef.current = previewBoundsRef.current;
    previewObjectsRef.current = null;
    previewBoundsRef.current = null;

    redrawInk();
    clearActive();
    if (selectionBoundsRef.current) drawSelectionOverlay(selectionBoundsRef.current);
  };

  // ---- 선택 오브젝트에 대한 액션 (툴바/키보드에서 ref로 호출) ----
  //
  // 터치 기기에서는 손가락 하나로 캔버스를 드래그하는 동시에 다른 손가락으로 툴바
  // 버튼을 누를 수 있고, 데스크탑에서는 마우스 버튼을 누른 채로 Ctrl+C 등을 누를 수
  // 있다. 드래그 도중 이 액션들이 호출되면 dragOriginalObjectsRef 등이 이미 사라진
  // 오브젝트를 가리키게 되어 다음 pointermove/up에서 잘못된 상태로 커밋될 수 있으므로,
  // 선택 상태를 바꾸는 액션은 먼저 진행 중인 드래그를 취소(미리보기 되돌리기)하고 시작한다.
  const cancelDrag = () => {
    if (dragModeRef.current === "none") return;
    dragModeRef.current = "none";
    dragStartRef.current = null;
    dragOriginalObjectsRef.current = null;
    dragOriginalBoundsRef.current = null;
    pendingPreviewRef.current = null;
    previewObjectsRef.current = null;
    previewBoundsRef.current = null;
    redrawInk();
    clearActive();
  };

  const copySelection = () => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    clipboardRef.current = objectsRef.current.filter((o) => ids.has(o.id)).map((o) => ({ ...o }));
  };

  const deleteSelection = () => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    cancelDrag();
    objectsRef.current = objectsRef.current.filter((o) => !ids.has(o.id));
    redrawInk();
    clearSelection();
  };

  const cutSelection = () => {
    copySelection();
    deleteSelection();
  };

  const duplicateSelection = () => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    cancelDrag();
    const originals = objectsRef.current.filter((o) => ids.has(o.id));
    const clones = originals.map((o) => duplicateObject(o));
    objectsRef.current = [...objectsRef.current, ...clones];
    redrawInk();
    selectedIdsRef.current = new Set(clones.map((o) => o.id));
    selectionBoundsRef.current = unionBounds(clones.map(getBounds));
    drawSelectionOverlay(selectionBoundsRef.current);
  };

  const recolorSelection = (color: string) => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    cancelDrag();
    objectsRef.current = objectsRef.current.map((o) => (ids.has(o.id) ? recolorObject(o, color) : o));
    redrawInk();
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) return;
    cancelDrag();
    const clones = clipboardRef.current.map((o) => duplicateObject(o));
    objectsRef.current = [...objectsRef.current, ...clones];
    redrawInk();
    selectedIdsRef.current = new Set(clones.map((o) => o.id));
    selectionBoundsRef.current = unionBounds(clones.map(getBounds));
    drawSelectionOverlay(selectionBoundsRef.current);
    onSelectionChangeRef.current?.(true);
  };

  useImperativeHandle(
    ref,
    () => ({
      copySelection,
      cutSelection,
      deleteSelection,
      duplicateSelection,
      recolorSelection,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // 도구를 바꾸면 진행 중이던 드래프트/미리보기를 정리한다.
  useEffect(() => {
    shapeDraftRef.current = null;
    if (dragModeRef.current === "none") lassoDraftRef.current = null;

    if (settings.tool === "eraser" && lastPointerRef.current) {
      drawEraserCursor(lastPointerRef.current.x, lastPointerRef.current.y);
    } else if (settings.tool !== "lasso" || !selectionBoundsRef.current) {
      clearActive();
    }
    if (settings.tool !== "lasso") clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tool, settings.eraserLevel]);

  // 캔버스 크기 대응: ResizeObserver + devicePixelRatio 스케일링.
  useEffect(() => {
    const container = containerRef.current;
    const ink = inkCanvasRef.current;
    const active = activeCanvasRef.current;
    const selection = selectionCanvasRef.current;
    if (!container || !ink || !active || !selection) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      sizeRef.current = { width: rect.width, height: rect.height };

      for (const canvas of [ink, active, selection]) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
      }

      const inkCtx = ink.getContext("2d");
      const activeCtx = active.getContext("2d");
      const selectionCtx = selection.getContext("2d");
      if (!inkCtx || !activeCtx || !selectionCtx) return;
      inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      selectionCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      inkCtxRef.current = inkCtx;
      activeCtxRef.current = activeCtx;
      selectionCtxRef.current = selectionCtx;

      redrawInk();
      redrawActive();
      if (selectionBoundsRef.current) drawSelectionOverlay(selectionBoundsRef.current);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 키보드 단축키: Delete/Backspace 삭제, Ctrl/Cmd+C/X/V 복사/오려두기/붙여넣기 (올가미 도구일 때만).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsRef.current.tool !== "lasso") return;
      const key = e.key.toLowerCase();
      const meta = e.ctrlKey || e.metaKey;

      if ((e.key === "Delete" || e.key === "Backspace") && selectedIdsRef.current) {
        e.preventDefault();
        deleteSelection();
      } else if (meta && key === "c" && selectedIdsRef.current) {
        e.preventDefault();
        copySelection();
      } else if (meta && key === "x" && selectedIdsRef.current) {
        e.preventDefault();
        cutSelection();
      } else if (meta && key === "v") {
        e.preventDefault();
        pasteClipboard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pointer Events 통합 입력 처리 (mousedown/touchstart 등은 사용하지 않는다).
  useEffect(() => {
    const active = activeCanvasRef.current;
    if (!active) return;

    const eraseAt = (x: number, y: number) => {
      const s = settingsRef.current;
      const radius = ERASER_RADIUS[s.eraserLevel];
      const objects = objectsRef.current;

      if (s.eraserMode === "stroke") {
        const next = objects.filter((o) => !hitTestObject(o, x, y, radius));
        if (next.length !== objects.length) {
          objectsRef.current = next;
          redrawInk();
        }
        return;
      }

      // 일반 모드: 스트로크는 부분 삭제(분할), 도형은 통째로 삭제.
      let changed = false;
      const next: CanvasObject[] = [];
      for (const obj of objects) {
        if (obj.objectType === "shape") {
          if (hitTestObject(obj, x, y, radius)) {
            changed = true;
          } else {
            next.push(obj);
          }
          continue;
        }
        const { strokes: fragments, changed: strokeChanged } = erasePartial([obj], x, y, radius);
        if (strokeChanged) changed = true;
        next.push(...fragments);
      }
      if (changed) {
        objectsRef.current = next;
        redrawInk();
      }
    };

    const handleLassoPointerDown = (point: Pt) => {
      const bounds = selectionBoundsRef.current;
      if (bounds) {
        const handle = getHandleRect(bounds);
        if (pointInBounds(point.x, point.y, handle)) {
          dragModeRef.current = "resize";
          dragStartRef.current = point;
          dragOriginalObjectsRef.current = snapshotSelected();
          dragOriginalBoundsRef.current = bounds;
          return;
        }
        if (pointInBounds(point.x, point.y, bounds)) {
          dragModeRef.current = "move";
          dragStartRef.current = point;
          dragOriginalObjectsRef.current = snapshotSelected();
          return;
        }
        clearSelection();
      }

      lassoDraftRef.current = [point];
      scheduleFrame(redrawLassoDraft);
    };

    // scheduleFrame은 한 프레임에 하나의 콜백만 실행한다. 매번 새 클로저를 넘기면 프레임이
    // 밀렸을 때 중간의 최신 포인터 위치가 버려질 수 있으므로, ref에 최신값만 갱신해두고
    // 실제 실행되는 콜백은 항상 그 ref를 그 시점에 읽도록 한다.
    const flushSelectionPreview = () => {
      const preview = pendingPreviewRef.current;
      if (preview) renderSelectionPreview(preview);
    };

    const handleSelectionMove = (point: Pt) => {
      const start = dragStartRef.current;
      const originals = dragOriginalObjectsRef.current;
      if (!start || !originals) return;
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      pendingPreviewRef.current = originals.map((o) => translateObject(o, dx, dy));
      scheduleFrame(flushSelectionPreview);
    };

    const handleSelectionResize = (point: Pt) => {
      const originals = dragOriginalObjectsRef.current;
      const originalBounds = dragOriginalBoundsRef.current;
      if (!originals || !originalBounds) return;

      const pivotX = originalBounds.x;
      const pivotY = originalBounds.y;
      const newWidth = Math.max(10, point.x - pivotX);
      const newHeight = Math.max(10, point.y - pivotY);
      // 종횡비를 유지하도록 두 축 중 더 작은 배율로 통일한다.
      const scale = Math.min(newWidth / Math.max(originalBounds.width, 1), newHeight / Math.max(originalBounds.height, 1));

      pendingPreviewRef.current = originals.map((o) => scaleObject(o, scale, scale, pivotX, pivotY));
      scheduleFrame(flushSelectionPreview);
    };

    const finalizeShapeDraft = () => {
      const draft = shapeDraftRef.current;
      shapeDraftRef.current = null;
      clearActive();
      if (!draft || draft.length < 2) return;

      const kind = classifyShape(draft);
      if (!kind) return; // 닫힌 도형으로 인식되지 않으면 그냥 버린다.

      const bounds = boundsFromPoints(draft);
      const s = settingsRef.current;
      const shape = createShapeObject(kind, bounds, s.shapeColor, s.shapeStrokeWidth);
      objectsRef.current = [...objectsRef.current, shape];
      redrawInk();
    };

    const finalizeLasso = () => {
      const draft = lassoDraftRef.current;
      lassoDraftRef.current = null;
      clearSelectionLayer();
      if (!draft || draft.length < 3) {
        clearSelection();
        return;
      }

      const selected = objectsRef.current.filter((o) => objectIntersectsLasso(o, draft));
      if (selected.length === 0) {
        clearSelection();
        return;
      }

      selectedIdsRef.current = new Set(selected.map((o) => o.id));
      selectionBoundsRef.current = unionBounds(selected.map(getBounds));
      drawSelectionOverlay(selectionBoundsRef.current);
      onSelectionChangeRef.current?.(true);
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
      lastPointerRef.current = point;
      const s = settingsRef.current;

      if (s.tool === "eraser") {
        eraseAt(point.x, point.y);
        drawEraserCursor(point.x, point.y);
        return;
      }

      if (s.tool === "shape") {
        shapeDraftRef.current = [{ x: point.x, y: point.y }];
        scheduleFrame(redrawShapeDraft);
        return;
      }

      if (s.tool === "lasso") {
        handleLassoPointerDown(point);
        return;
      }

      const isHighlighter = s.tool === "highlighter";
      const stroke = createStroke(
        isHighlighter ? "highlighter" : "pen",
        isHighlighter ? undefined : s.penType,
        isHighlighter ? s.highlighterColor : s.penColor,
        isHighlighter ? s.highlighterSize : s.penSize,
        isHighlighter ? 50 : s.sharpness,
        isHighlighter ? 0.35 : 1,
        e.pointerType as PointerKind,
      );
      stroke.points.push(point);
      currentStrokeRef.current = stroke;
      scheduleFrame(redrawActive);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" && activePenIdRef.current !== null) return;

      const point = normalizePointerEvent(e, active);
      lastPointerRef.current = point;
      const s = settingsRef.current;

      if (s.tool === "eraser") {
        drawEraserCursor(point.x, point.y);
        if (e.buttons === 0) return; // 눌리지 않은 채 지나가는 hover는 미리보기만 갱신.
        eraseAt(point.x, point.y);
        return;
      }

      if (s.tool === "shape") {
        const draft = shapeDraftRef.current;
        if (!draft) return;
        draft.push(point);
        scheduleFrame(redrawShapeDraft);
        return;
      }

      if (s.tool === "lasso") {
        if (dragModeRef.current === "move") {
          handleSelectionMove(point);
          return;
        }
        if (dragModeRef.current === "resize") {
          handleSelectionResize(point);
          return;
        }
        const draft = lassoDraftRef.current;
        if (!draft) return;
        draft.push(point);
        scheduleFrame(redrawLassoDraft);
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

      const s = settingsRef.current;

      if (s.tool === "eraser") {
        if (e.pointerType === "touch") {
          clearActive();
        } else {
          const point = normalizePointerEvent(e, active);
          drawEraserCursor(point.x, point.y);
        }
        return;
      }

      if (s.tool === "shape") {
        finalizeShapeDraft();
        return;
      }

      if (s.tool === "lasso") {
        if (dragModeRef.current === "move" || dragModeRef.current === "resize") {
          commitSelectionTransform();
          return;
        }
        finalizeLasso();
        return;
      }

      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (!stroke || stroke.points.length === 0) return;

      objectsRef.current = [...objectsRef.current, stroke];
      redrawInk();
      clearActive();
    };

    const handlePointerLeave = (e: PointerEvent) => {
      // 그리기/지우기/드래그 진행 중(포인터 캡처 중)에는 아직 캔버스를 벗어난 게 아니므로 무시.
      if (active.hasPointerCapture(e.pointerId)) return;
      if (settingsRef.current.tool === "eraser") clearActive();
    };

    active.addEventListener("pointerdown", handlePointerDown);
    active.addEventListener("pointermove", handlePointerMove);
    active.addEventListener("pointerup", finishStroke);
    active.addEventListener("pointercancel", finishStroke);
    active.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      active.removeEventListener("pointerdown", handlePointerDown);
      active.removeEventListener("pointermove", handlePointerMove);
      active.removeEventListener("pointerup", finishStroke);
      active.removeEventListener("pointercancel", finishStroke);
      active.removeEventListener("pointerleave", handlePointerLeave);
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
      <canvas
        ref={selectionCanvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
});

export default DrawingCanvas;
