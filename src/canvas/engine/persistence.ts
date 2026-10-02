// IndexedDB 저장/불러오기. 이번 스프린트는 노트 1개만 관리한다 (범위 최소화).
// 스트로크/도형/텍스트/스티커는 순수 데이터라 그대로 저장 가능하지만, 이미지 오브젝트는
// HTMLImageElement를 들고 있어 구조화 복제(structured clone)가 불가능하므로
// element 대신 data URL(src)만 저장하고, 불러올 때 다시 이미지로 디코딩한다.

import { openDB, type DBSchema } from "idb";
import type { CanvasObject } from "./objectOps";
import type { ImageObject } from "./imageEngine";

type SerializedImageObject = Omit<ImageObject, "element"> & { src: string };
type SerializedObject = Exclude<CanvasObject, ImageObject> | SerializedImageObject;

interface NoteDB extends DBSchema {
  notes: {
    key: string;
    value: { objects: SerializedObject[] };
  };
}

const DB_NAME = "badnote";
const STORE_NAME = "notes";
const NOTE_KEY = "current";

function getDB() {
  return openDB<NoteDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

function serialize(obj: CanvasObject): SerializedObject {
  if (obj.objectType === "image") {
    const { element, ...rest } = obj;
    return { ...rest, src: element.src };
  }
  return obj;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("저장된 이미지를 불러오지 못했습니다."));
    img.src = src;
  });
}

async function deserialize(data: SerializedObject): Promise<CanvasObject> {
  if (data.objectType === "image") {
    const { src, ...rest } = data;
    const element = await loadImageElement(src);
    return { ...rest, element };
  }
  return data;
}

export async function saveNote(objects: CanvasObject[]): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, { objects: objects.map(serialize) }, NOTE_KEY);
}

export async function loadNote(): Promise<CanvasObject[]> {
  const db = await getDB();
  const record = await db.get(STORE_NAME, NOTE_KEY);
  if (!record) return [];
  // 저장된 이미지 중 하나가 깨져도 노트 전체를 못 여는 일이 없도록 개별 실패는 건너뛴다.
  const results = await Promise.allSettled(record.objects.map(deserialize));
  return results
    .filter((r): r is PromiseFulfilledResult<CanvasObject> => r.status === "fulfilled")
    .map((r) => r.value);
}
