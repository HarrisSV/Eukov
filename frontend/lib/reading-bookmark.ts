export type ReadingBookmark = {
  documentId: string;
  page: number;
  anchorText?: string;
  charOffset?: number;
  savedAt: number;
};

function bookmarkKey(documentId: string) {
  return `eukov-reading-bookmark-${documentId}`;
}

export function readReadingBookmark(documentId: string): ReadingBookmark | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(bookmarkKey(documentId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ReadingBookmark;
    if (
      parsed.documentId !== documentId ||
      typeof parsed.page !== "number" ||
      parsed.page < 1
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeReadingBookmark(bookmark: ReadingBookmark): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(bookmarkKey(bookmark.documentId), JSON.stringify(bookmark));
}

export function clearReadingBookmark(documentId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(bookmarkKey(documentId));
}

/** Page to open when resuming: explicit URL page wins, then saved bookmark, then fallback. */
export function resolveReadingResumePage(
  documentId: string,
  pageFromUrl?: number | null,
  fallback = 1,
): number {
  if (typeof pageFromUrl === "number" && Number.isFinite(pageFromUrl) && pageFromUrl > 0) {
    return Math.floor(pageFromUrl);
  }

  const bookmark = readReadingBookmark(documentId);
  if (bookmark?.page && bookmark.page > 0) {
    return bookmark.page;
  }

  return Math.max(1, fallback);
}

export function isViewBookmarked(documentId: string, leftPage: number): boolean {
  const bookmark = readReadingBookmark(documentId);
  return bookmark?.documentId === documentId && bookmark.page === leftPage;
}

export function selectionOffsetIn(container: HTMLElement): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return undefined;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer)) {
    return undefined;
  }

  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

export function pageNumberFromSelection(fallbackPage: number): number {
  if (typeof window === "undefined") {
    return fallbackPage;
  }

  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const pageElement = node?.parentElement?.closest("[data-page]");
  const pageValue = pageElement?.getAttribute("data-page");
  const parsed = pageValue ? Number(pageValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackPage;
}
