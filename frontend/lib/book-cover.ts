import { ensurePageSheetHtml } from "@/lib/paginate-html";

export const PAGE_COVER_PREFIX = "eukov:page-cover;base64,";

const PAGE_SHEET_MARKER = 'data-type="page-sheet"';

function extractDivInnerHtml(html: string, openStart: number): { inner: string; nextIndex: number } | null {
  const openEnd = html.indexOf(">", openStart);
  if (openEnd < 0) {
    return null;
  }

  let depth = 1;
  let cursor = openEnd + 1;

  while (cursor < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", cursor);
    const nextClose = html.indexOf("</div>", cursor);
    if (nextClose < 0) {
      return null;
    }
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return {
        inner: html.slice(openEnd + 1, nextClose),
        nextIndex: nextClose + 6,
      };
    }
    cursor = nextClose + 6;
  }

  return null;
}

function stripEditorChrome(html: string): string {
  return html
    .replace(/<div[^>]*data-type="page-break"[^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<div[^>]*data-type="section-break"[^>]*>[\s\S]*?<\/div>/gi, "");
}

export function extractFirstPageHtml(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return "";
  }

  const source = trimmed.includes(PAGE_SHEET_MARKER)
    ? trimmed
    : ensurePageSheetHtml(trimmed);

  const markerIdx = source.indexOf(PAGE_SHEET_MARKER);
  if (markerIdx < 0) {
    return stripEditorChrome(source);
  }

  const openStart = source.lastIndexOf("<div", markerIdx);
  if (openStart < 0) {
    return stripEditorChrome(source);
  }

  const extracted = extractDivInnerHtml(source, openStart);
  if (!extracted) {
    return stripEditorChrome(source);
  }

  return stripEditorChrome(extracted.inner).trim();
}

export function encodePageCoverUrl(pageHtml: string): string {
  const trimmed = pageHtml.trim();
  if (!trimmed) {
    return "";
  }

  const bytes = new TextEncoder().encode(trimmed);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `${PAGE_COVER_PREFIX}${btoa(binary)}`;
}

export function decodePageCoverUrl(url?: string | null): string | null {
  if (!url?.startsWith(PAGE_COVER_PREFIX)) {
    return null;
  }

  try {
    const base64 = url.slice(PAGE_COVER_PREFIX.length);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function isPageCoverUrl(url?: string): boolean {
  return Boolean(url?.startsWith(PAGE_COVER_PREFIX));
}

export function deriveCoverUrlFromReaderHtml(readerHtml?: string, content?: string): string {
  const html = readerHtml?.trim() || content?.trim() || "";
  const firstPage = extractFirstPageHtml(html);
  if (!firstPage) {
    return "";
  }
  return encodePageCoverUrl(firstPage);
}

/** Letter-size editor page at 96dpi. */
export const COVER_PAGE_WIDTH_PX = Math.round(8.5 * 96);
export const COVER_PAGE_HEIGHT_PX = Math.round(11 * 96);

export function coverScaleForSize(width: number, height: number): number {
  if (width <= 0 || height <= 0) {
    return 0.35;
  }
  return Math.min(width / COVER_PAGE_WIDTH_PX, height / COVER_PAGE_HEIGHT_PX);
}
