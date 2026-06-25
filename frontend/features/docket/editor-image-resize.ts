import {
  clampImageDimensions,
  resizeImageKeepingAspect,
} from "@/lib/image-fit";

export const IMAGE_MIN_SIZE = 48;

export function isCornerDirection(direction: number[]): boolean {
  return direction[0] !== 0 && direction[1] !== 0;
}

export function isVerticalEdgeDirection(direction: number[]): boolean {
  return direction[0] === 0 && direction[1] !== 0;
}

export function isHorizontalEdgeDirection(direction: number[]): boolean {
  return direction[0] !== 0 && direction[1] === 0;
}

export function rotationOnlyTransform(rotation: number): string {
  return rotation ? `rotate(${rotation}deg)` : "";
}

export interface ResizeSessionBase {
  width: number;
  height: number;
  posX: number;
  posY: number;
}

export interface ResizeCommitInput {
  direction: number[];
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  base: ResizeSessionBase;
  naturalWidth: number;
  naturalHeight: number;
  maxWidth: number;
  maxHeight: number;
}

export interface ResizeCommitResult {
  width: number;
  height: number;
  posX: number;
  posY: number;
}

/** MS Word: corners keep aspect ratio; edges change one axis and keep the opposite edge fixed. */
export function commitWordLikeResize(input: ResizeCommitInput): ResizeCommitResult {
  const { direction, base, naturalWidth, naturalHeight, maxWidth, maxHeight } = input;

  let width = Math.max(IMAGE_MIN_SIZE, input.width);
  let height = Math.max(IMAGE_MIN_SIZE, input.height);

  if (isCornerDirection(direction)) {
    const fitted = resizeImageKeepingAspect(
      width,
      naturalWidth,
      naturalHeight,
      maxWidth,
      maxHeight,
    );
    width = fitted.width;
    height = fitted.height;
  } else if (isVerticalEdgeDirection(direction)) {
    width = base.width;
    height = Math.min(maxHeight, Math.max(IMAGE_MIN_SIZE, height));
  } else if (isHorizontalEdgeDirection(direction)) {
    height = base.height;
    width = Math.min(maxWidth, Math.max(IMAGE_MIN_SIZE, width));
  } else {
    const fitted = clampImageDimensions(width, height, maxWidth, maxHeight);
    width = fitted.width;
    height = fitted.height;
  }

  let translateX = input.translateX;
  let translateY = input.translateY;

  if (isCornerDirection(direction) && input.width > 0 && input.height > 0) {
    const scale = Math.min(width / input.width, height / input.height);
    translateX = Math.round(translateX * scale);
    translateY = Math.round(translateY * scale);
  } else if (isVerticalEdgeDirection(direction) && input.height > 0) {
    translateY = Math.round(translateY * (height / input.height));
    translateX = 0;
  } else if (isHorizontalEdgeDirection(direction) && input.width > 0) {
    translateX = Math.round(translateX * (width / input.width));
    translateY = 0;
  }

  return {
    width,
    height,
    posX: Math.round(base.posX + translateX),
    posY: Math.round(base.posY + translateY),
  };
}
