import {
  htmlToPlainText,
  leftPageForTarget,
  viewEndPage,
  type ReaderSpreadMode,
} from "@/features/reader/page-content";

export type BookSearchMatch = {
  pageNumber: number;
  matchIndex: number;
  snippet: string;
  charOffset: number;
};

export function searchBookPages(
  pages: Array<{ pageNumber: number; content: string }>,
  query: string,
): BookSearchMatch[] {
  const normalized = query.trim();
  if (!normalized || normalized.length < 2) {
    return [];
  }

  const lowerQuery = normalized.toLowerCase();
  const matches: BookSearchMatch[] = [];
  let matchIndex = 0;

  for (const page of pages) {
    const text = htmlToPlainText(page.content);
    const lower = text.toLowerCase();
    let position = 0;

    while (position < lower.length) {
      const found = lower.indexOf(lowerQuery, position);
      if (found === -1) {
        break;
      }

      const snippetStart = Math.max(0, found - 36);
      const snippetEnd = Math.min(text.length, found + normalized.length + 36);
      let snippet = text.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim();
      if (snippetStart > 0) {
        snippet = `…${snippet}`;
      }
      if (snippetEnd < text.length) {
        snippet = `${snippet}…`;
      }

      matches.push({
        pageNumber: page.pageNumber,
        matchIndex,
        snippet,
        charOffset: found,
      });
      matchIndex += 1;
      position = found + 1;
    }
  }

  return matches;
}

export function getUniquePagesWithMatches(matches: BookSearchMatch[]): number[] {
  return [...new Set(matches.map((match) => match.pageNumber))].sort((a, b) => a - b);
}

export function resolveSearchNavigationPage(
  matchingPages: number[],
  totalPages: number,
  mode: ReaderSpreadMode,
): number | null {
  if (matchingPages.length === 0) {
    return null;
  }

  const sorted = [...new Set(matchingPages)].sort((a, b) => a - b);

  if (mode === "double" && sorted.length === 2) {
    const [left, right] = sorted;
    if (right === left + 1 && left % 2 === 1) {
      return left;
    }
  }

  const firstPage = sorted[0];
  if (!firstPage) {
    return null;
  }

  return leftPageForTarget(firstPage, totalPages, mode);
}

export function highlightSearchOnPages(pageNumbers: number[], query: string): number {
  let total = 0;
  for (const pageNumber of pageNumbers) {
    total += highlightSearchOnPage(pageNumber, query);
  }
  return total;
}

export function highlightSearchOnPage(pageNumber: number, query: string): number {
  const containers = getPageTextContainers(pageNumber);
  let total = 0;
  for (const container of containers) {
    total += highlightSearchQuery(container, query);
  }
  return total;
}

export function clearSearchHighlightsOnPages(pageNumbers: number[]) {
  for (const pageNumber of pageNumbers) {
    clearSearchHighlightsOnPage(pageNumber);
  }
}

export function clearSearchHighlightsOnPage(pageNumber: number) {
  for (const container of getPageTextContainers(pageNumber)) {
    clearSearchHighlights(container);
  }
}

function getPageTextContainers(pageNumber: number): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `[data-flipbook-page="${pageNumber}"] .reader-page__text-inner`,
    ),
  );
}

export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  mode: ReaderSpreadMode,
): number[] {
  const end = viewEndPage(currentPage, totalPages, mode);
  const pages: number[] = [];
  for (let pageNumber = currentPage; pageNumber <= end; pageNumber += 1) {
    pages.push(pageNumber);
  }
  return pages;
}

function pageHasSearchHighlights(pageNumber: number): boolean {
  return getPageTextContainers(pageNumber).some(
    (container) => container.querySelector("mark.reader-search-highlight") !== null,
  );
}

export function scheduleSearchHighlights(
  pageNumbers: number[],
  query: string,
  options?: { attempts?: number; intervalMs?: number },
): () => void {
  const normalized = query.trim();
  if (!normalized || normalized.length < 2 || pageNumbers.length === 0) {
    return () => undefined;
  }

  const attempts = options?.attempts ?? 16;
  const intervalMs = options?.intervalMs ?? 100;
  let attempt = 0;
  let rafId = 0;
  let timeoutId: number | undefined;

  const tick = () => {
    attempt += 1;
    highlightSearchOnPages(pageNumbers, normalized);
    const complete = pageNumbers.every((pageNumber) => pageHasSearchHighlights(pageNumber));
    if (complete || attempt >= attempts) {
      return;
    }
    timeoutId = window.setTimeout(tick, intervalMs);
  };

  rafId = window.requestAnimationFrame(tick);

  return () => {
    window.cancelAnimationFrame(rafId);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  };
}

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

function buildTextIndex(root: HTMLElement): { text: string; segments: TextSegment[] } {
  const segments: TextSegment[] = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const content = node.textContent ?? "";
    if (!content) {
      continue;
    }
    segments.push({ node, start: text.length, end: text.length + content.length });
    text += content;
  }

  return { text, segments };
}

function locateTextOffset(
  segments: TextSegment[],
  offset: number,
): { node: Text; nodeOffset: number } | null {
  if (segments.length === 0) {
    return null;
  }

  for (const segment of segments) {
    if (offset >= segment.start && offset < segment.end) {
      return { node: segment.node, nodeOffset: offset - segment.start };
    }
  }

  const last = segments[segments.length - 1];
  const lastLength = last.node.textContent?.length ?? 0;
  return { node: last.node, nodeOffset: lastLength };
}

function wrapHighlightRange(segments: TextSegment[], start: number, end: number) {
  const startPos = locateTextOffset(segments, start);
  const endPos = locateTextOffset(segments, Math.max(start, end - 1));
  if (!startPos || !endPos) {
    return;
  }

  const range = document.createRange();
  range.setStart(startPos.node, startPos.nodeOffset);
  range.setEnd(endPos.node, endPos.nodeOffset + 1);

  const mark = document.createElement("mark");
  mark.className = "reader-search-highlight";

  try {
    range.surroundContents(mark);
  } catch {
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);
  }
}

export function highlightSearchQuery(root: HTMLElement, query: string): number {
  clearSearchHighlights(root);
  const normalized = query.trim();
  if (!normalized || normalized.length < 2) {
    return 0;
  }

  const lowerQuery = normalized.toLowerCase();
  const { text, segments } = buildTextIndex(root);
  if (!text || segments.length === 0) {
    return 0;
  }

  const lower = text.toLowerCase();
  const matches: Array<{ start: number; end: number }> = [];
  let position = 0;

  while (position < lower.length) {
    const found = lower.indexOf(lowerQuery, position);
    if (found === -1) {
      break;
    }
    matches.push({ start: found, end: found + normalized.length });
    position = found + 1;
  }

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    wrapHighlightRange(segments, match.start, match.end);
  }

  return matches.length;
}

export function clearSearchHighlights(root: HTMLElement) {
  root.querySelectorAll("mark.reader-search-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  });
}

const WORD_PATTERN = /\b[\p{L}\p{N}']+\b/gu;

export function buildBookWordIndex(pages: Array<{ content: string }>): string[] {
  const seen = new Map<string, string>();

  for (const page of pages) {
    const text = htmlToPlainText(page.content);
    for (const token of text.match(WORD_PATTERN) ?? []) {
      if (token.length < 2) {
        continue;
      }
      const key = token.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, token);
      }
    }
  }

  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export function suggestBookWords(index: string[], query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }

  return index.filter((word) => word.toLowerCase().startsWith(normalized));
}
