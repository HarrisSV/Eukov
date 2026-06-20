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

/** Map any page number to the left page of the spread that contains it. */
export function leftPageForTarget(targetPage: number, totalPages: number): number {
  const clamped = Math.min(Math.max(1, Math.floor(targetPage)), Math.max(1, totalPages));

  for (const left of spreadLeftPages(totalPages)) {
    const end = spreadEndPage(left, totalPages);
    if (clamped >= left && clamped <= end) {
      return left;
    }
  }

  return 1;
}

export function isHtmlContent(content: string): boolean {
  return /^\s*</.test(content.trim());
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
