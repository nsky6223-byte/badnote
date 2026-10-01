// 이미지 오브젝트: 파일 선택(데스크탑/모바일 공용 input[type=file])이나
// 드래그 앤 드롭으로 들어온 이미지를 캔버스 오브젝트로 보관/렌더링한다.
// cropX/Y/Width/Height는 원본 이미지 좌표계 기준으로, 어느 영역을 보여줄지를 담는다
// (자르기 전에는 원본 전체를 가리킨다).

export type ImageObject = {
  id: string;
  objectType: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  element: HTMLImageElement;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
};

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

const MAX_INITIAL_DIMENSION = 320;

export function createImageObject(element: HTMLImageElement, centerX: number, centerY: number): ImageObject {
  const naturalWidth = element.naturalWidth || 1;
  const naturalHeight = element.naturalHeight || 1;
  const scale = Math.min(1, MAX_INITIAL_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    id: crypto.randomUUID(),
    objectType: "image",
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    element,
    cropX: 0,
    cropY: 0,
    cropWidth: naturalWidth,
    cropHeight: naturalHeight,
  };
}

export function renderImage(ctx: CanvasRenderingContext2D, obj: ImageObject) {
  ctx.drawImage(
    obj.element,
    obj.cropX,
    obj.cropY,
    obj.cropWidth,
    obj.cropHeight,
    obj.x,
    obj.y,
    obj.width,
    obj.height,
  );
}

// 단순화된 자르기: 화면에 보이는 박스 크기(x,y,width,height)는 그대로 두고, 원본에서
// 샘플링하는 영역(cropWidth/Height)만 줄여서 "확대해서 자르는" 느낌을 낸다. 좌상단을
// 기준점으로 고정해 기존 리사이즈 핸들 하나로 자르기까지 처리할 수 있게 했다.
export function cropImage(obj: ImageObject, scaleX: number, scaleY: number): ImageObject {
  return {
    ...obj,
    cropWidth: Math.max(10, obj.cropWidth * scaleX),
    cropHeight: Math.max(10, obj.cropHeight * scaleY),
  };
}
