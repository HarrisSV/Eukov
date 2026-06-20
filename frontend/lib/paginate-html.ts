import { bodyToHtml, escapeHtml } from "@/lib/document-import";

/** ~334 words ≈ three pages per 1000-word manuscript in page view. */
export const WORDS_PER_PAGE = 334;

export const PAGE_BREAK_HTML =
  '<div data-type="page-break" class="editor-page-break" contenteditable="false">' +
  '<span class="editor-page-break__label">—— Page Break ——</span></div>';

const PAGE_SHEET_OPEN =
  '<div data-type="page-sheet" class="draft-page-sheet">';
const PAGE_SHEET_CLOSE = "</div>";

export function extractWords(html: string): string[] {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ") : [];
}

export function countWordsInHtml(html: string): number {
  return extractWords(html).length;
}

function isExistingPageBreak(html: string): boolean {
  return /data-type="page-break"/.test(html);
}

function normalizeHtmlForPagination(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const wrap = document.createElement("div");
  wrap.innerHTML = html;

  const blocks: string[] = [];
  for (const child of Array.from(wrap.children)) {
    const type = child.getAttribute("data-type");
    if (type === "page-break") {
      continue;
    }
    if (type === "page-sheet") {
      for (const block of Array.from(child.children)) {
        blocks.push(block.outerHTML);
      }
      continue;
    }
    blocks.push(child.outerHTML);
  }

  return blocks.join("");
}

function splitHtmlIntoBlocks(html: string): string[] {
  if (typeof document === "undefined") {
    return [html];
  }

  const wrap = document.createElement("div");
  wrap.innerHTML = html;
  return Array.from(wrap.children).map((el) => el.outerHTML);
}

function splitBlockByWordLimit(blockHtml: string, maxWords: number): string[] {
  const words = extractWords(blockHtml);
  if (words.length <= maxWords) {
    return [blockHtml];
  }

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(
      `<p>${escapeHtml(words.slice(i, i + maxWords).join(" "))}</p>`,
    );
  }
  return chunks;
}

export function needsPagination(
  html: string,
  wordsPerPage: number = WORDS_PER_PAGE,
): boolean {
  const normalized = normalizeHtmlForPagination(html);
  const words = countWordsInHtml(normalized);
  if (words <= wordsPerPage) {
    return false;
  }

  const sheetCount = (html.match(/data-type="page-sheet"/g) || []).length;
  if (sheetCount === 0) {
    return true;
  }

  const expectedPages = Math.ceil(words / wordsPerPage);
  return sheetCount !== expectedPages;
}

export function ensurePaginatedHtml(
  html: string,
  wordsPerPage: number = WORDS_PER_PAGE,
): string {
  if (!needsPagination(html, wordsPerPage)) {
    return html;
  }
  return paginateHtml(html, wordsPerPage);
}

/**
 * Splits HTML into page sheets separated by page breaks so long
 * documents (e.g. 1000 words) flow across multiple pages in page view.
 */
export function paginateHtml(
  html: string,
  wordsPerPage: number = WORDS_PER_PAGE,
): string {
  const normalized = normalizeHtmlForPagination(html.trim());
  if (!normalized || normalized === "<p></p>") {
    return normalized || "<p></p>";
  }

  const blocks = splitHtmlIntoBlocks(normalized).filter(
    (block) => !isExistingPageBreak(block),
  );
  if (blocks.length === 0) {
    return normalized;
  }

  const pages: string[][] = [[]];
  let wordsOnPage = 0;

  for (const block of blocks) {
    const chunks = splitBlockByWordLimit(block, wordsPerPage);
    for (const chunk of chunks) {
      const wordCount = extractWords(chunk).length;
      if (wordsOnPage > 0 && wordsOnPage + wordCount > wordsPerPage) {
        pages.push([]);
        wordsOnPage = 0;
      }
      pages[pages.length - 1].push(chunk);
      wordsOnPage += wordCount;
    }
  }

  return pages
    .map((pageBlocks, index) => {
      const sheet = `${PAGE_SHEET_OPEN}${pageBlocks.join("")}${PAGE_SHEET_CLOSE}`;
      return index === 0 ? sheet : `${PAGE_BREAK_HTML}${sheet}`;
    })
    .join("");
}

export function plainTextToPaginatedHtml(text: string): string {
  return paginateHtml(bodyToHtml(text));
}

export function mergeAndPaginateHtml(currentHtml: string, insertedHtml: string): string {
  const current = normalizeHtmlForPagination(currentHtml);
  const inserted = normalizeHtmlForPagination(insertedHtml);
  if (!current || current === "<p></p>") {
    return paginateHtml(inserted);
  }
  if (!inserted || inserted === "<p></p>") {
    return paginateHtml(current);
  }
  return paginateHtml(`${current}${inserted}`);
}
