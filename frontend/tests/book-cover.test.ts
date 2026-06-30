import { describe, expect, it } from "vitest";
import {
  COVER_PAGE_HEIGHT_PX,
  COVER_PAGE_WIDTH_PX,
  coverScaleForSize,
  decodePageCoverUrl,
  deriveCoverUrlFromReaderHtml,
  encodePageCoverUrl,
  extractFirstPageHtml,
  isPageCoverUrl,
  PAGE_COVER_PREFIX,
} from "@/lib/book-cover";

describe("book-cover", () => {
  it("extracts the first editor page sheet", () => {
    const html =
      '<div data-type="page-sheet"><h1>Cover Title</h1><p>By Author</p></div>' +
      '<div data-type="page-break"></div>' +
      '<div data-type="page-sheet"><p>Chapter one</p></div>';

    expect(extractFirstPageHtml(html)).toContain("Cover Title");
    expect(extractFirstPageHtml(html)).not.toContain("Chapter one");
  });

  it("wraps bare html in a page sheet before extracting", () => {
    expect(extractFirstPageHtml("<p>Opening line</p>")).toContain("Opening line");
  });

  it("returns null for missing cover urls", () => {
    expect(decodePageCoverUrl(undefined)).toBeNull();
    expect(decodePageCoverUrl("")).toBeNull();
  });

  it("round-trips page cover urls", () => {
    const html = "<h1>My Book</h1><figure><img src=\"https://example.com/a.jpg\" /></figure>";
    const url = encodePageCoverUrl(html);
    expect(url.startsWith(PAGE_COVER_PREFIX)).toBe(true);
    expect(isPageCoverUrl(url)).toBe(true);
    expect(decodePageCoverUrl(url)).toBe(html);
  });

  it("derives cover url from reader html", () => {
    const url = deriveCoverUrlFromReaderHtml(
      '<div data-type="page-sheet"><h1>Front Page</h1></div>',
    );
    expect(isPageCoverUrl(url)).toBe(true);
    expect(decodePageCoverUrl(url)).toContain("Front Page");
  });

  it("scales a letter page to fit a cover thumbnail", () => {
    const scale = coverScaleForSize(160, 240);
    expect(scale).toBeCloseTo(Math.min(160 / COVER_PAGE_WIDTH_PX, 240 / COVER_PAGE_HEIGHT_PX));
  });
});
