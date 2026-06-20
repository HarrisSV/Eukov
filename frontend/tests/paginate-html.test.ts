import { describe, expect, it } from "vitest";
import {
  ensurePaginatedHtml,
  needsPagination,
  paginateHtml,
  WORDS_PER_PAGE,
} from "@/lib/paginate-html";

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i + 1}`).join(" ");
}

describe("paginateHtml", () => {
  it("returns empty paragraph unchanged", () => {
    expect(paginateHtml("<p></p>")).toBe("<p></p>");
  });

  it("wraps short content in a single page sheet", () => {
    const html = `<p>${words(50)}</p>`;
    const result = paginateHtml(html);
    expect(result).toContain('data-type="page-sheet"');
    expect(result).not.toContain('data-type="page-break"');
  });

  it("splits long content across multiple pages", () => {
    const html = `<p>${words(WORDS_PER_PAGE + 120)}</p>`;
    const result = paginateHtml(html);
    expect(result).toContain('data-type="page-break"');
    const sheets = result.match(/data-type="page-sheet"/g);
    expect(sheets?.length).toBeGreaterThanOrEqual(2);
  });

  it("splits 1000 words into three pages", () => {
    const html = `<p>${words(1000)}</p>`;
    const result = paginateHtml(html);
    const sheets = result.match(/data-type="page-sheet"/g)?.length ?? 0;
    expect(sheets).toBe(3);
  });

  it("splits 1000 words in three paragraphs into three pages", () => {
    const html =
      `<p>${words(333)}</p><p>${words(333)}</p><p>${words(334)}</p>`;
    const result = paginateHtml(html);
    const sheets = result.match(/data-type="page-sheet"/g)?.length ?? 0;
    expect(sheets).toBe(3);
  });

  it("re-paginates content already on a single page sheet", () => {
    const single = paginateHtml(`<p>${words(1000)}</p>`);
    expect(needsPagination(single)).toBe(false);
    const repaginated = ensurePaginatedHtml(single);
    expect(repaginated).toBe(single);
  });
});
