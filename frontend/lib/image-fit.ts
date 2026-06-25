import {
  EDITOR_PAGE_CONTENT_HEIGHT_PX,
  EDITOR_PAGE_CONTENT_WIDTH_PX,
} from "@/lib/editor-page-layout";

export {
  EDITOR_PAGE_CONTENT_HEIGHT_PX,
  EDITOR_PAGE_CONTENT_WIDTH_PX,
};

/** @deprecated Use EDITOR_PAGE_CONTENT_WIDTH_PX */
export const EDITOR_PAGE_CONTENT_MAX_WIDTH = EDITOR_PAGE_CONTENT_WIDTH_PX;

const MIN_IMAGE_SIZE = 48;

export function fitImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = EDITOR_PAGE_CONTENT_WIDTH_PX,
  maxHeight: number = EDITOR_PAGE_CONTENT_HEIGHT_PX,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: MIN_IMAGE_SIZE, height: MIN_IMAGE_SIZE };
  }

  const scale = Math.min(
    1,
    maxWidth / naturalWidth,
    maxHeight / naturalHeight,
  );

  return {
    width: Math.max(MIN_IMAGE_SIZE, Math.round(naturalWidth * scale)),
    height: Math.max(MIN_IMAGE_SIZE, Math.round(naturalHeight * scale)),
  };
}

export function clampImageDimensions(
  width: number,
  height: number,
  maxWidth: number = EDITOR_PAGE_CONTENT_WIDTH_PX,
  maxHeight: number = EDITOR_PAGE_CONTENT_HEIGHT_PX,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: MIN_IMAGE_SIZE, height: MIN_IMAGE_SIZE };
  }

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(MIN_IMAGE_SIZE, Math.round(width * scale)),
    height: Math.max(MIN_IMAGE_SIZE, Math.round(height * scale)),
  };
}

/** Keep the image's natural aspect ratio while resizing and clamping to the page box. */
export function resizeImageKeepingAspect(
  nextWidth: number,
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = EDITOR_PAGE_CONTENT_WIDTH_PX,
  maxHeight: number = EDITOR_PAGE_CONTENT_HEIGHT_PX,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return clampImageDimensions(nextWidth, nextWidth, maxWidth, maxHeight);
  }

  const aspect = naturalWidth / naturalHeight;
  const width = Math.max(MIN_IMAGE_SIZE, nextWidth);
  const height = Math.max(MIN_IMAGE_SIZE, Math.round(width / aspect));
  return clampImageDimensions(width, height, maxWidth, maxHeight);
}

/** Same as resizeImageKeepingAspect, but driven by target height. */
export function resizeImageKeepingAspectByHeight(
  nextHeight: number,
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = EDITOR_PAGE_CONTENT_WIDTH_PX,
  maxHeight: number = EDITOR_PAGE_CONTENT_HEIGHT_PX,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return clampImageDimensions(nextHeight, nextHeight, maxWidth, maxHeight);
  }

  const aspect = naturalWidth / naturalHeight;
  const height = Math.max(MIN_IMAGE_SIZE, nextHeight);
  const width = Math.max(MIN_IMAGE_SIZE, Math.round(height * aspect));
  return clampImageDimensions(width, height, maxWidth, maxHeight);
}

/** Repair width/height pairs that no longer match the image's natural aspect ratio. */
export function normalizeImageDimensions(
  width: number,
  _height: number,
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number = EDITOR_PAGE_CONTENT_WIDTH_PX,
  maxHeight: number = EDITOR_PAGE_CONTENT_HEIGHT_PX,
): { width: number; height: number } {
  return resizeImageKeepingAspect(width, naturalWidth, naturalHeight, maxWidth, maxHeight);
}

export function measureEditorContentMaxWidth(element: HTMLElement | null): number {
  if (!element) {
    return EDITOR_PAGE_CONTENT_WIDTH_PX;
  }

  const pageSheet = element.closest(".draft-page-sheet") as HTMLElement | null;
  const host = pageSheet ?? (element.closest(".tiptap") as HTMLElement | null);
  if (!host) {
    return EDITOR_PAGE_CONTENT_WIDTH_PX;
  }

  const width = host.clientWidth;
  if (width <= 0) {
    return EDITOR_PAGE_CONTENT_WIDTH_PX;
  }

  const styles = getComputedStyle(host);
  const padding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
  const available = Math.floor(width - padding);

  return available > MIN_IMAGE_SIZE ? available : EDITOR_PAGE_CONTENT_WIDTH_PX;
}

export function stripFullWidthImageStyles(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  for (const img of doc.querySelectorAll("img")) {
    img.removeAttribute("width");
    img.removeAttribute("height");
    img.style.width = "";
    img.style.height = "";
    img.style.maxWidth = "";
    img.style.maxHeight = "";
  }

  return doc.body.innerHTML;
}
