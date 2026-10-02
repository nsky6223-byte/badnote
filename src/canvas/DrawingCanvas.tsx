import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { normalizePointerEvent, type PointerKind } from "./engine/pointerInput";
import { engineHooks } from "./engine/hooks";
import { inputPipeline } from "./engine/inputPipeline";
import { createImageObject, cropImage, loadImageFromFile } from "./engine/imageEngine";
import {
  boundsFromPoints,
  classifyShape,
  createShapeObject,
  type Pt,
} from "./engine/shapeEngine";
import { createStickerObject } from "./engine/stickerEngine";
import {
  createStroke,
  ERASER_RADIUS,
  erasePartial,
  type Stroke,
} from "./engine/strokeEngine";
import { createTextObject, type TextObject } from "./engine/textEngine";
import { loadNote, saveNote } from "./engine/persistence";
import { eventRuntime } from "../events/core/runtime";
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

export type SelectionInfo = {
  hasSelection: boolean;
  canRecolor: boolean;
  canCrop: boolean;
  cropActive: boolean;
};

const NO_SELECTION: SelectionInfo = {
  hasSelection: false,
  canRecolor: false,
  canCrop: false,
  cropActive: false,
};

export type HistoryInfo = {
  canUndo: boolean;
  canRedo: boolean;
};

export type DrawingCanvasHandle = {
  copySelection: () => void;
  cutSelection: () => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  recolorSelection: (color: string) => void;
  toggleCrop: () => void;
  addImage: (file: File) => void;
  undo: () => void;
  redo: () => void;
};

type Props = {
  settings: DrawSettings;
  onSelectionChange?: (info: SelectionInfo) => void;
  onHistoryChange?: (info: HistoryInfo) => void;
};

const HANDLE_SIZE = 14;
const LASER_FADE_MS = 600;

function getHandleRect(bounds: Bounds): Bounds {
  return {
    x: bounds.x + bounds.width - HANDLE_SIZE / 2,
    y: bounds.y + bounds.height - HANDLE_SIZE / 2,
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
  };
}

type EditingText = {
  original: TextObject | null; // 기존 오브젝트를 편집 중이면 취소 시 복원하기 위해 보관.
  preEditObjects: CanvasObject[]; // 편집 시작 전 objectsRef 스냅샷 (undo에 이 상태로 남긴다)
  x: number;
  y: number;
  value: string;
  color: string;
  fontSize: number;
};

const DrawingCanvas = forwardRef<DrawingCanvasHandle, Props>(function DrawingCanvas(
  { settings, onSelectionChange, onHistoryChange },
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
  const cropModeIdRef = useRef<string | null>(null);

  // Undo/Redo: objectsRef가 바뀔 때마다 "바뀌기 전" 배열 참조를 스택에 쌓는다. 배열은
  // 매번 새로 만들어 교체할 뿐 제자리에서 mutate하지 않으므로, 옛 참조를 그대로 보관해도
  // 안전하다 (복제 비용 없음).
  const undoStackRef = useRef<CanvasObject[][]>([]);
  const redoStackRef = useRef<CanvasObject[][]>([]);
  const eraseGestureHistoryPushedRef = useRef(false);

  // 로컬 저장: 변경 후 일정 시간 조용하면 IndexedDB에 저장한다.
  const saveTimerRef = useRef<number | null>(null);

  // 레이저 포인터: 오브젝트로 커밋되지 않는 휘발성 트레일이라 objectsRef와 무관하게 관리.
  const laserPointsRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const laserActiveRef = useRef(false);
  const laserLoopRunningRef = useRef(false);

  const sizeRef = useRef({ width: 0, height: 0 });
  const lastPointerRef = useRef<Pt | null>(null);
  const activePenIdRef = useRef<number | null>(null);
  // 미니게임이 열려있는 동안 등 이벤트 시스템이 EngineAdapter.pauseInput()으로 끌 수 있는
  // 입력 잠금. true인 동안은 포인터 입력을 전부 무시한다.
  const inputPausedRef = useRef(false);

  const [editingText, setEditingText] = useState<EditingText | null>(null);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const onHistoryChangeRef = useRef(onHistoryChange);
  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

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

  // ---- Undo/Redo + 로컬 저장 ----
  //
  // 실제 오브젝트 변경(스트로크 커밋, 지우개, 도형/스티커/이미지/텍스트 추가, 삭제/복제/
  // 색상변경, 선택 이동·크기조정 커밋)이 일어나는 모든 지점에서 pushHistory()를 호출한다.
  // history를 남기는 시점 = 저장해야 하는 시점이기도 하므로, 저장 예약도 여기서 함께 한다.

  const MAX_HISTORY = 50;
  const SAVE_DEBOUNCE_MS = 1500;

  const notifyHistoryChange = () => {
    onHistoryChangeRef.current?.({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    });
  };

  const scheduleSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      saveNote(objectsRef.current).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  };

  // snapshot: "바뀌기 전" 오브젝트 배열. 대부분은 objectsRef.current를 그대로 넘기면 되지만,
  // 텍스트 편집처럼 "편집 시작 시점"과 "커밋 시점" 사이에 다른 변경이 끼어있는 경우를 위해
  // 호출부가 직접 snapshot을 지정할 수 있게 열어둔다.
  const pushHistorySnapshot = (snapshot: CanvasObject[]) => {
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
    redoStackRef.current = [];
    notifyHistoryChange();
    scheduleSave();
  };

  const pushHistory = () => pushHistorySnapshot(objectsRef.current);

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    cancelDrag();
    redoStackRef.current.push(objectsRef.current);
    objectsRef.current = prev;
    redrawInk();
    clearSelection();
    notifyHistoryChange();
    scheduleSave();
    engineHooks.emit("history:undo", {});
  };

  const redo = () => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    cancelDrag();
    undoStackRef.current.push(objectsRef.current);
    objectsRef.current = next;
    redrawInk();
    clearSelection();
    notifyHistoryChange();
    scheduleSave();
    engineHooks.emit("history:redo", {});
  };

  // object:commit/erase 훅은 반드시 "실제로 objectsRef.current가 바뀐 뒤" 호출해서
  // all이 최신 상태를 가리키게 한다 (pushHistory는 반대로 바뀌기 전 상태를 캡처해야 하므로
  // 호출 순서가 섞이지 않도록 주의).
  const emitObjectCommit = (object: CanvasObject) => {
    engineHooks.emit("object:commit", { object, all: objectsRef.current });
  };

  const emitErase = () => {
    engineHooks.emit("erase", { all: objectsRef.current });
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
    ctx.strokeStyle = cropModeIdRef.current ? "#e8590c" : "#1971c2";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.setLineDash([]);
    const handle = getHandleRect(bounds);
    ctx.fillStyle = cropModeIdRef.current ? "#e8590c" : "#1971c2";
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

  // 현재 선택에 대해 툴바가 보여줄 수 있는 액션을 계산한다.
  // (이미지/스티커는 색상 변경이 안 되고, 자르기는 이미지 1개만 선택했을 때만 가능)
  const computeSelectionInfo = (ids: Set<string>): SelectionInfo => {
    const selected = objectsRef.current.filter((o) => ids.has(o.id));
    const canRecolor = selected.some((o) => o.objectType !== "image" && o.objectType !== "sticker");
    const canCrop = selected.length === 1 && selected[0].objectType === "image";
    const cropActive = canCrop && cropModeIdRef.current === selected[0].id;
    return { hasSelection: true, canRecolor, canCrop, cropActive };
  };

  const clearSelection = () => {
    if (!selectedIdsRef.current) return;
    selectedIdsRef.current = null;
    selectionBoundsRef.current = null;
    cropModeIdRef.current = null;
    clearSelectionLayer();
    onSelectionChangeRef.current?.(NO_SELECTION);
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

    pushHistory();
    objectsRef.current = objectsRef.current.filter((o) => !ids.has(o.id)).concat(preview);
    selectionBoundsRef.current = previewBoundsRef.current;
    previewObjectsRef.current = null;
    previewBoundsRef.current = null;

    redrawInk();
    clearActive();
    if (selectionBoundsRef.current) drawSelectionOverlay(selectionBoundsRef.current);
    for (const obj of preview) emitObjectCommit(obj);
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
    pushHistory();
    objectsRef.current = objectsRef.current.filter((o) => !ids.has(o.id));
    redrawInk();
    clearSelection();
    emitErase();
  };

  const cutSelection = () => {
    copySelection();
    deleteSelection();
  };

  const duplicateSelection = () => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    cancelDrag();
    cropModeIdRef.current = null;
    pushHistory();
    const originals = objectsRef.current.filter((o) => ids.has(o.id));
    const clones = originals.map((o) => duplicateObject(o));
    objectsRef.current = [...objectsRef.current, ...clones];
    redrawInk();
    const newIds = new Set(clones.map((o) => o.id));
    selectedIdsRef.current = newIds;
    selectionBoundsRef.current = unionBounds(clones.map(getBounds));
    drawSelectionOverlay(selectionBoundsRef.current);
    onSelectionChangeRef.current?.(computeSelectionInfo(newIds));
    for (const obj of clones) emitObjectCommit(obj);
  };

  const recolorSelection = (color: string) => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    cancelDrag();
    pushHistory();
    objectsRef.current = objectsRef.current.map((o) => (ids.has(o.id) ? recolorObject(o, color) : o));
    redrawInk();
  };

  const pasteClipboard = () => {
    if (clipboardRef.current.length === 0) return;
    cancelDrag();
    cropModeIdRef.current = null;
    pushHistory();
    const clones = clipboardRef.current.map((o) => duplicateObject(o));
    objectsRef.current = [...objectsRef.current, ...clones];
    redrawInk();
    const newIds = new Set(clones.map((o) => o.id));
    selectedIdsRef.current = newIds;
    selectionBoundsRef.current = unionBounds(clones.map(getBounds));
    drawSelectionOverlay(selectionBoundsRef.current);
    onSelectionChangeRef.current?.(computeSelectionInfo(newIds));
    for (const obj of clones) emitObjectCommit(obj);
  };

  const toggleCrop = () => {
    const ids = selectedIdsRef.current;
    if (!ids) return;
    const info = computeSelectionInfo(ids);
    if (!info.canCrop) return;
    // 드래그 도중 자르기를 켜고 끄면 이후 pointermove가 이전 드래그 기준점으로 자르기/
    // 리사이즈를 섞어서 적용하게 되므로, 모드를 바꾸기 전에 진행 중인 드래그를 정리한다.
    cancelDrag();
    const [onlyId] = Array.from(ids);
    cropModeIdRef.current = cropModeIdRef.current === onlyId ? null : onlyId;
    if (selectionBoundsRef.current) drawSelectionOverlay(selectionBoundsRef.current);
    onSelectionChangeRef.current?.(computeSelectionInfo(ids));
  };

  const addImageAt = (file: File, centerX: number, centerY: number) => {
    loadImageFromFile(file)
      .then((element) => {
        pushHistory();
        const obj = createImageObject(element, centerX, centerY);
        objectsRef.current = [...objectsRef.current, obj];
        redrawInk();
        emitObjectCommit(obj);
      })
      .catch(() => {
        // 잘못된 파일 등으로 로드에 실패하면 조용히 무시한다.
      });
  };

  const addImage = (file: File) => {
    addImageAt(file, sizeRef.current.width / 2, sizeRef.current.height / 2);
  };

  useImperativeHandle(
    ref,
    () => ({
      copySelection,
      cutSelection,
      deleteSelection,
      duplicateSelection,
      recolorSelection,
      toggleCrop,
      addImage,
      undo,
      redo,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ---- 텍스트 편집 (실제 DOM textarea로 입력받아 한글 IME 조합을 그대로 지원) ----
  //
  // editingText는 textarea를 그리기 위한 React 상태지만, "편집 중인 세션이 있는지"를
  // 포인터 이벤트 핸들러(ref 기반 클로저) 안에서 동기적으로 읽고 즉시 커밋해야 하는
  // 경우가 있다 (예: A를 편집하다가 블러되기 전에 캔버스의 다른 지점을 바로 탭하는
  // 경우 — pointerdown이 blur보다 먼저 발생하므로 state만 믿으면 A의 내용이 사라진다).
  // 그래서 editingTextRef를 별도로 두고 항상 최신 세션을 미러링한다.
  const editingTextRef = useRef<EditingText | null>(null);

  const applyEditingTextCommit = (session: EditingText, cancel: boolean) => {
    if (cancel) {
      if (session.original) {
        objectsRef.current = [...objectsRef.current, session.original];
        redrawInk();
      }
      return;
    }

    if (session.value.trim().length === 0) {
      if (session.original) {
        // 기존 텍스트를 비워서 삭제한 셈 — 편집 시작 전 상태를 undo에 남긴다.
        pushHistorySnapshot(session.preEditObjects);
        redrawInk();
        emitErase();
      }
      return;
    }

    pushHistorySnapshot(session.preEditObjects);
    const obj = createTextObject(session.x, session.y, session.value, session.color, session.fontSize);
    if (session.original) obj.id = session.original.id;
    objectsRef.current = [...objectsRef.current, obj];
    redrawInk();
    emitObjectCommit(obj);
  };

  const commitEditingText = (cancel: boolean) => {
    const session = editingTextRef.current;
    if (!session) return;
    applyEditingTextCommit(session, cancel);
    editingTextRef.current = null;
    setEditingText(null);
  };

  // 편집 중인 세션이 있으면 먼저 확정하고 새 세션을 연다 (blur를 기다리지 않는다).
  const openTextEditing = (session: EditingText) => {
    if (editingTextRef.current) {
      applyEditingTextCommit(editingTextRef.current, false);
    }
    editingTextRef.current = session;
    setEditingText(session);
  };

  // 다른 도구로 바꾸면 편집 중이던 텍스트를 자동으로 확정한다.
  useEffect(() => {
    if (settings.tool !== "text") {
      commitEditingText(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.tool]);

  // ---- 레이저 포인터: 오브젝트를 만들지 않는 휘발성 트레일 애니메이션 ----

  const runLaserLoop = () => {
    const ctx = activeCtxRef.current;
    if (!ctx) {
      laserLoopRunningRef.current = false;
      return;
    }

    const now = performance.now();
    laserPointsRef.current = laserPointsRef.current.filter((p) => now - p.t < LASER_FADE_MS);

    ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    const color = settingsRef.current.laserColor;
    for (const p of laserPointsRef.current) {
      const life = Math.max(0, 1 - (now - p.t) / LASER_FADE_MS);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.globalAlpha = life * 0.85;
      ctx.arc(p.x, p.y, 5 * life + 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (laserPointsRef.current.length > 0 || laserActiveRef.current) {
      requestAnimationFrame(runLaserLoop);
    } else {
      laserLoopRunningRef.current = false;
    }
  };

  const ensureLaserLoop = () => {
    if (laserLoopRunningRef.current) return;
    laserLoopRunningRef.current = true;
    requestAnimationFrame(runLaserLoop);
  };

  // 레이저를 누른 채로 컴포넌트가 언마운트되면(드물지만) laserActiveRef가 true로 남아
  // rAF 루프가 영원히 스스로를 재예약할 수 있으므로, 언마운트 시 강제로 멈춘다.
  useEffect(() => {
    return () => {
      laserActiveRef.current = false;
      laserPointsRef.current = [];
    };
  }, []);

  // 도구가 바뀔 때마다 훅으로 알린다 (지우개 레벨 변경은 도구 변경이 아니므로 제외).
  useEffect(() => {
    engineHooks.emit("tool:change", { tool: settings.tool });
  }, [settings.tool]);

  // 도구를 바꾸면 진행 중이던 드래프트/미리보기를 정리한다.
  useEffect(() => {
    // 이동/크기조정 드래그 도중 도구가 바뀌면(터치 멀티탭, 키보드 단축키 등) 드래그를
    // 먼저 취소해서 잉크 레이어를 원래대로 되돌린다 — 그렇지 않으면 미리보기 때문에
    // 잠시 숨겨둔 오브젝트가 objectsRef에는 그대로 있지만 화면에서만 사라진 채로 남는다.
    cancelDrag();
    shapeDraftRef.current = null;
    lassoDraftRef.current = null;
    if (settings.tool !== "laser") {
      laserPointsRef.current = [];
      laserActiveRef.current = false;
    }

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

  // 저장된 노트 불러오기 (새로고침/재방문 시 복원). 이미지 디코딩이 끼어있어 비동기다.
  useEffect(() => {
    let cancelled = false;
    loadNote()
      .then((objects) => {
        if (cancelled || objects.length === 0) return;
        objectsRef.current = objects;
        redrawInk();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 페이지를 벗어날 때 디바운스를 기다리지 않고 바로 저장을 시도한다 (완료 보장은 안 되지만
  // 대부분의 브라우저에서 짧은 동기적 저장 정도는 끝까지 처리해준다).
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      saveNote(objectsRef.current).catch(() => {});
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // 이벤트 시스템(글리치/밈/미니게임) 런타임을 시작한다. 엔진은 이벤트의 존재를
  // 모르지만, 이벤트가 노트를 조작할 수 있도록 좁은 EngineAdapter 하나는 등록해줘야 한다.
  // EVENTS_SPEC.md 9장 "data 글리치·미니게임 결과를 Undo로 되돌릴 수 있나"는 아직
  // 팀 결정이 안 나서, 가장 단순하고 기존 동작과 일관된 "허용"을 기본값으로 삼았다
  // (pushHistory를 거치므로 다른 모든 변경과 똑같이 undo/redo된다).
  useEffect(() => {
    const stop = eventRuntime.start({
      adapter: {
        getObjects: () => objectsRef.current,
        addObjects: (objects) => {
          if (objects.length === 0) return;
          pushHistory();
          objectsRef.current = [...objectsRef.current, ...objects];
          redrawInk();
          for (const obj of objects) emitObjectCommit(obj);
        },
        updateObject: (id, patch) => {
          const exists = objectsRef.current.some((o) => o.id === id);
          if (!exists) return;
          pushHistory();
          objectsRef.current = objectsRef.current.map((o) =>
            o.id === id ? ({ ...o, ...patch } as CanvasObject) : o,
          );
          redrawInk();
        },
        pauseInput: () => {
          inputPausedRef.current = true;
        },
        resumeInput: () => {
          inputPausedRef.current = false;
        },
        requestRedraw: () => redrawInk(),
      },
    });
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 데스크탑 드래그 앤 드롭으로 이미지 추가 (도구 선택과 무관하게 항상 동작).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const rect = container.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;
      let placed = 0;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        // 한 번에 여러 장을 놓으면 서로 겹치지 않도록 조금씩 어긋나게 배치한다.
        const offset = placed * 24;
        addImageAt(file, dropX + offset, dropY + offset);
        placed++;
      }
    };

    container.addEventListener("dragover", handleDragOver);
    container.addEventListener("drop", handleDrop);
    return () => {
      container.removeEventListener("dragover", handleDragOver);
      container.removeEventListener("drop", handleDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 키보드 단축키: Ctrl/Cmd+Z 실행취소, Shift+Z 또는 Y 다시실행 (도구 무관),
  // Delete/Backspace 삭제, Ctrl/Cmd+C/X/V 복사/오려두기/붙여넣기 (올가미 도구일 때만).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 편집 중(textarea에 포커스)에는 브라우저 자체의 입력 되돌리기/복사 등을
      // 그대로 쓸 수 있어야 하므로 우리 단축키 처리를 건너뛴다.
      if (e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      const meta = e.ctrlKey || e.metaKey;

      if (meta && key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (meta && (key === "y" || (key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      if (settingsRef.current.tool !== "lasso") return;

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

    // 누르고 있는 동안 eraseAt가 pointermove마다 반복 호출되지만, 하나의 지우개 제스처는
    // undo에서 한 단계여야 하므로 그 제스처의 "첫 실제 변경"에서만 history를 남긴다.
    const pushEraseHistoryOnce = () => {
      if (eraseGestureHistoryPushedRef.current) return;
      eraseGestureHistoryPushedRef.current = true;
      pushHistory();
    };

    const eraseAt = (x: number, y: number) => {
      const s = settingsRef.current;
      const radius = ERASER_RADIUS[s.eraserLevel];
      const objects = objectsRef.current;

      if (s.eraserMode === "stroke") {
        const next = objects.filter((o) => !hitTestObject(o, x, y, radius));
        if (next.length !== objects.length) {
          pushEraseHistoryOnce();
          objectsRef.current = next;
          redrawInk();
          emitErase();
        }
        return;
      }

      // 일반 모드: 스트로크는 부분 삭제(분할), 그 외(도형/이미지/텍스트/스티커)는 통째로 삭제.
      let changed = false;
      const next: CanvasObject[] = [];
      for (const obj of objects) {
        if (obj.objectType !== "stroke") {
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
        pushEraseHistoryOnce();
        objectsRef.current = next;
        redrawInk();
        emitErase();
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
      const scaleX = newWidth / Math.max(originalBounds.width, 1);
      const scaleY = newHeight / Math.max(originalBounds.height, 1);

      // 자르기 모드: 화면 박스 크기는 그대로 두고 이미지 안에서 샘플링하는 영역만 줄인다.
      const single = originals.length === 1 ? originals[0] : null;
      if (cropModeIdRef.current && single && single.objectType === "image" && single.id === cropModeIdRef.current) {
        pendingPreviewRef.current = [cropImage(single, scaleX, scaleY)];
        scheduleFrame(flushSelectionPreview);
        return;
      }

      // 일반 리사이즈: 종횡비를 유지하도록 두 축 중 더 작은 배율로 통일한다.
      const scale = Math.min(scaleX, scaleY);
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
      pushHistory();
      objectsRef.current = [...objectsRef.current, shape];
      redrawInk();
      emitObjectCommit(shape);
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

      const ids = new Set(selected.map((o) => o.id));
      selectedIdsRef.current = ids;
      selectionBoundsRef.current = unionBounds(selected.map(getBounds));
      drawSelectionOverlay(selectionBoundsRef.current);
      onSelectionChangeRef.current?.(computeSelectionInfo(ids));
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (inputPausedRef.current) return; // 미니게임 등이 열려있는 동안은 필기를 막는다.
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
        eraseGestureHistoryPushedRef.current = false;
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

      if (s.tool === "sticker") {
        pushHistory();
        const sticker = createStickerObject(s.stickerKind, point.x, point.y);
        objectsRef.current = [...objectsRef.current, sticker];
        redrawInk();
        emitObjectCommit(sticker);
        return;
      }

      if (s.tool === "image") {
        return; // 이미지는 파일 선택/드래그앤드롭으로만 추가한다.
      }

      if (s.tool === "text") {
        // 캔버스는 포커스를 받을 수 없는 요소라서, 이 클릭이 끝날 때(mouseup) 브라우저가
        // 기본 동작으로 포커스를 되돌리면서 방금 autoFocus로 포커스를 준 textarea가
        // blur되어 버린다 — 그 blur가 즉시 commitEditingText를 호출해 입력창이 뜨자마자
        // 사라지는 원인이었다. preventDefault로 그 기본 포커스 처리를 막는다.
        e.preventDefault();
        const hit = objectsRef.current.find(
          (o) => o.objectType === "text" && pointInBounds(point.x, point.y, getBounds(o)),
        ) as TextObject | undefined;

        if (hit) {
          const preEditObjects = objectsRef.current; // 제거 전 스냅샷 (undo용)
          objectsRef.current = objectsRef.current.filter((o) => o.id !== hit.id);
          redrawInk();
          openTextEditing({
            original: hit,
            preEditObjects,
            x: hit.x,
            y: hit.y,
            value: hit.text,
            color: hit.color,
            fontSize: hit.fontSize,
          });
        } else {
          openTextEditing({
            original: null,
            preEditObjects: objectsRef.current,
            x: point.x,
            y: point.y,
            value: "",
            color: s.textColor,
            fontSize: s.textFontSize,
          });
        }
        return;
      }

      if (s.tool === "laser") {
        laserActiveRef.current = true;
        laserPointsRef.current.push({ x: point.x, y: point.y, t: performance.now() });
        ensureLaserLoop();
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
      const processedPoint = inputPipeline.process(point, { toolKind: stroke.kind });
      stroke.points.push(processedPoint);
      currentStrokeRef.current = stroke;
      engineHooks.emit("stroke:start", { stroke });
      engineHooks.emit("stroke:point", { point: processedPoint, stroke });
      scheduleFrame(redrawActive);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (inputPausedRef.current) return;
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

      if (s.tool === "sticker" || s.tool === "image" || s.tool === "text") return;

      if (s.tool === "laser") {
        if (!laserActiveRef.current) return;
        laserPointsRef.current.push({ x: point.x, y: point.y, t: performance.now() });
        return;
      }

      const stroke = currentStrokeRef.current;
      if (!stroke) return;
      const processedPoint = inputPipeline.process(point, { toolKind: stroke.kind });
      stroke.points.push(processedPoint);
      engineHooks.emit("stroke:point", { point: processedPoint, stroke });
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

      if (s.tool === "sticker" || s.tool === "image" || s.tool === "text") return;

      if (s.tool === "laser") {
        laserActiveRef.current = false;
        return;
      }

      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (!stroke || stroke.points.length === 0) return;

      pushHistory();
      objectsRef.current = [...objectsRef.current, stroke];
      redrawInk();
      clearActive();
      emitObjectCommit(stroke);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {editingText && (
        <textarea
          autoFocus
          value={editingText.value}
          onChange={(e) =>
            setEditingText((cur) => {
              if (!cur) return cur;
              const next = { ...cur, value: e.target.value };
              editingTextRef.current = next;
              return next;
            })
          }
          onBlur={() => commitEditingText(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              commitEditingText(true);
            }
          }}
          style={{
            position: "absolute",
            left: editingText.x,
            top: editingText.y,
            minWidth: 140,
            minHeight: editingText.fontSize * 1.3 + 8,
            font: `${editingText.fontSize}px system-ui, "Segoe UI", sans-serif`,
            color: editingText.color,
            border: "1px dashed #1971c2",
            background: "rgba(255,255,255,0.92)",
            padding: 2,
            resize: "both",
            outline: "none",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
});

export default DrawingCanvas;
