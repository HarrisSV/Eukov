import { describe, expect, it } from "vitest";
import { findPageSplitIndex } from "@/features/docket/editor-page-flow";
import { ensurePageSheetHtml } from "@/lib/paginate-html";

describe("findPageSplitIndex", () => {
  it("returns null when all blocks fit", () => {
    expect(findPageSplitIndex([100, 120, 80], 400)).toBeNull();
  });

  it("splits before the overflowing block", () => {
    expect(findPageSplitIndex([100, 120, 80, 90], 260)).toBe(2);
  });

  it("returns null when a single block exceeds the page", () => {
    expect(findPageSplitIndex([500], 400)).toBeNull();
  });
});

describe("ensurePageSheetHtml", () => {
  it("wraps bare paragraphs in a page sheet", () => {
    expect(ensurePageSheetHtml("<p>Hello</p>")).toContain('data-type="page-sheet"');
  });

  it("leaves already paginated content unchanged", () => {
    const html = '<div data-type="page-sheet"><p>Hello</p></div>';
    expect(ensurePageSheetHtml(html)).toBe(html);
  });
});
