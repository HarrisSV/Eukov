import { describe, expect, it } from "vitest";
import {
  formatViewLabel,
  nextViewPage,
  prevViewPage,
  viewPageOptions,
} from "@/features/reader/page-content";
import {
  buildBookWordIndex,
  getUniquePagesWithMatches,
  getVisiblePageNumbers,
  highlightSearchQuery,
  resolveSearchNavigationPage,
  searchBookPages,
  suggestBookWords,
} from "@/lib/book-search";

describe("view page navigation", () => {
  it("advances one page at a time in single-page mode", () => {
    expect(nextViewPage(1, 5, "single")).toBe(2);
    expect(prevViewPage(2, "single")).toBe(1);
    expect(formatViewLabel(3, 5, "single")).toBe("3");
    expect(viewPageOptions(3, "single")).toEqual([1, 2, 3]);
  });

  it("keeps spread navigation in double-page mode", () => {
    expect(nextViewPage(1, 5, "double")).toBe(3);
    expect(prevViewPage(3, "double")).toBe(1);
    expect(formatViewLabel(1, 5, "double")).toBe("1-2");
  });
});

describe("searchBookPages", () => {
  it("finds word matches across pages with snippets", () => {
    const matches = searchBookPages(
      [
        { pageNumber: 1, content: "<p>Lorem ipsum dolor sit amet.</p>" },
        { pageNumber: 2, content: "<p>Another lorem passage here.</p>" },
      ],
      "lorem",
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]?.pageNumber).toBe(1);
    expect(matches[1]?.pageNumber).toBe(2);
    expect(matches[0]?.snippet.toLowerCase()).toContain("lorem");
  });

  it("requires at least two characters", () => {
    expect(searchBookPages([{ pageNumber: 1, content: "hello" }], "l")).toEqual([]);
  });
});

describe("resolveSearchNavigationPage", () => {
  it("navigates to the first matching page in single-page mode", () => {
    expect(resolveSearchNavigationPage([3, 5, 7], 10, "single")).toBe(3);
  });

  it("navigates to the first matching spread in double-page mode", () => {
    expect(resolveSearchNavigationPage([3, 5, 7], 10, "double")).toBe(3);
  });

  it("opens a paired spread when matches appear on consecutive odd-even pages", () => {
    expect(resolveSearchNavigationPage([3, 4], 10, "double")).toBe(3);
    expect(resolveSearchNavigationPage([1, 2], 10, "double")).toBe(1);
    expect(resolveSearchNavigationPage([5, 6], 10, "double")).toBe(5);
  });

  it("falls back to the first page spread when two pages are not a spread pair", () => {
    expect(resolveSearchNavigationPage([2, 3], 10, "double")).toBe(1);
    expect(resolveSearchNavigationPage([4, 5], 10, "double")).toBe(3);
  });
});

describe("getUniquePagesWithMatches", () => {
  it("returns sorted unique page numbers", () => {
    const matches = searchBookPages(
      [
        { pageNumber: 2, content: "alpha beta" },
        { pageNumber: 1, content: "alpha once" },
        { pageNumber: 2, content: "alpha again" },
      ],
      "alpha",
    );

    expect(getUniquePagesWithMatches(matches)).toEqual([1, 2]);
  });
});

describe("getVisiblePageNumbers", () => {
  it("returns only the current page in single-page mode", () => {
    expect(getVisiblePageNumbers(2, 10, "single")).toEqual([2]);
  });

  it("returns both pages in a spread for double-page mode", () => {
    expect(getVisiblePageNumbers(1, 10, "double")).toEqual([1, 2]);
  });
});

describe("highlightSearchQuery", () => {
  it("highlights matches that span multiple inline elements", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>The Project <strong>Guten</strong>berg eBook</p>";

    const count = highlightSearchQuery(root, "Gutenberg");

    expect(count).toBe(1);
    expect(root.querySelectorAll("mark.reader-search-highlight")).toHaveLength(1);
    expect(root.querySelector("mark.reader-search-highlight")?.textContent).toBe("Gutenberg");
  });

  it("highlights every match in the page text", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>Gutenberg license for Gutenberg readers</p>";

    const count = highlightSearchQuery(root, "Gutenberg");

    expect(count).toBe(2);
    expect(root.querySelectorAll("mark.reader-search-highlight")).toHaveLength(2);
  });
});

describe("book word index", () => {
  it("builds a sorted unique vocabulary from pages", () => {
    const index = buildBookWordIndex([
      { content: "<p>Zebra apple banana.</p>" },
      { content: "<p>Apple zebra again.</p>" },
    ]);

    expect(index).toEqual(["again", "apple", "banana", "Zebra"]);
  });

  it("suggests prefix matches in alphabetical order", () => {
    const index = buildBookWordIndex([
      { content: "alpha alphabet almanac beta" },
      { content: "altar" },
    ]);

    expect(suggestBookWords(index, "al")).toEqual(["almanac", "alpha", "alphabet", "altar"]);
    expect(suggestBookWords(index, "be")).toEqual(["beta"]);
  });
});
