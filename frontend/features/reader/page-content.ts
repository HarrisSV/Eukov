export type ReaderSpreadMode = "double" | "single";

export function nextSpreadLeft(currentLeft: number, totalPages: number): number {
  if (currentLeft + 1 >= totalPages) {
    return currentLeft;
  }
  return Math.min(totalPages, currentLeft + 2);
}

export function prevSpreadLeft(currentLeft: number): number {
  return Math.max(1, currentLeft - 2);
}

export function rightPageNumber(leftPage: number, totalPages: number): number | null {
  const right = leftPage + 1;
  return right <= totalPages ? right : null;
}

export function spreadEndPage(leftPage: number, totalPages: number): number {
  return rightPageNumber(leftPage, totalPages) ?? leftPage;
}

export function formatSpreadLabel(leftPage: number, totalPages: number): string {
  const end = spreadEndPage(leftPage, totalPages);
  return end === leftPage ? String(leftPage) : `${leftPage}-${end}`;
}

/** Left page index for each visible spread in reading order. */
export function spreadLeftPages(totalPages: number): number[] {
  if (totalPages <= 0) {
    return [1];
  }

  const spreads: number[] = [];
  let left = 1;

  while (left <= totalPages) {
    spreads.push(left);
    const next = nextSpreadLeft(left, totalPages);
    if (next === left) {
      break;
    }
    left = next;
  }

  return spreads;
}

export function nextViewPage(
  currentPage: number,
  totalPages: number,
  mode: ReaderSpreadMode,
): number {
  if (mode === "single") {
    return Math.min(totalPages, currentPage + 1);
  }
  return nextSpreadLeft(currentPage, totalPages);
}

export function prevViewPage(currentPage: number, mode: ReaderSpreadMode): number {
  if (mode === "single") {
    return Math.max(1, currentPage - 1);
  }
  return prevSpreadLeft(currentPage);
}

export function viewEndPage(
  currentPage: number,
  totalPages: number,
  mode: ReaderSpreadMode,
): number {
  if (mode === "single") {
    return currentPage;
  }
  return spreadEndPage(currentPage, totalPages);
}

export function formatViewLabel(
  currentPage: number,
  totalPages: number,
  mode: ReaderSpreadMode,
): string {
  if (mode === "single") {
    return String(currentPage);
  }
  return formatSpreadLabel(currentPage, totalPages);
}

export function viewPageOptions(totalPages: number, mode: ReaderSpreadMode): number[] {
  if (mode === "single") {
    return Array.from({ length: Math.max(1, totalPages) }, (_, index) => index + 1);
  }
  return spreadLeftPages(totalPages);
}

/** Map any page number to the active view page (spread left or single page). */
export function leftPageForTarget(
  targetPage: number,
  totalPages: number,
  mode: ReaderSpreadMode = "double",
): number {
  const clamped = Math.min(Math.max(1, Math.floor(targetPage)), Math.max(1, totalPages));

  if (mode === "single") {
    return clamped;
  }

  for (const left of spreadLeftPages(totalPages)) {
    const end = spreadEndPage(left, totalPages);
    if (clamped >= left && clamped <= end) {
      return left;
    }
  }

  return 1;
}

const HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i;

export function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  if (/^\s*</.test(trimmed)) {
    return true;
  }
  // Gutenberg listings and other sources often paginate mid-paragraph with inline tags.
  return HTML_TAG_PATTERN.test(trimmed);
}

export function htmlToPlainText(content: string): string {
  if (!isHtmlContent(content)) {
    return content;
  }
  if (typeof document === "undefined") {
    return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = content;
  return wrap.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
