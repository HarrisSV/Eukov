import { describe, expect, it } from "vitest";
import {
  activeChapterId,
  annotateChapters,
  resolveChapterHeadingTag,
} from "@/features/reader/chapters";

describe("resolveChapterHeadingTag", () => {
  it("prefers h1 when present", () => {
    const pages = [
      { content: "<h2>Section</h2><p>Body</p>" },
      { content: "<h1>Chapter Two</h1><p>More</p>" },
    ];
    expect(resolveChapterHeadingTag(pages)).toBe("h1");
  });

  it("falls back to the first heading level when no h1 exists", () => {
    const pages = [{ content: "<h2>Intro</h2><h3>Part</h3><p>Body</p>" }];
    expect(resolveChapterHeadingTag(pages)).toBe("h2");
  });

  it("returns null for plain text pages", () => {
    expect(resolveChapterHeadingTag([{ content: "Plain chapter one" }])).toBeNull();
  });
});

describe("annotateChapters", () => {
  it("extracts h1 chapters and injects navigation markers", () => {
    const { chapters, pages } = annotateChapters([
      { pageNumber: 1, content: "<h1>Opening</h1><p>Text</p>" },
      { pageNumber: 2, content: "<h1>Next</h1><p>More text</p>" },
    ]);

    expect(chapters).toEqual([
      { id: "chapter-0", title: "Opening", pageNumber: 1 },
      { id: "chapter-1", title: "Next", pageNumber: 2 },
    ]);
    expect(pages[0]?.content).toContain('data-chapter-id="chapter-0"');
    expect(pages[1]?.content).toContain('data-chapter-id="chapter-1"');
  });

  it("uses imported heading levels when h1 is absent", () => {
    const { chapters } = annotateChapters([
      { pageNumber: 1, content: "<h2>Imported Chapter</h2><p>Body</p>" },
    ]);

    expect(chapters).toEqual([
      { id: "chapter-0", title: "Imported Chapter", pageNumber: 1 },
    ]);
  });
});

describe("activeChapterId", () => {
  const chapters = [
    { id: "chapter-0", title: "One", pageNumber: 1 },
    { id: "chapter-1", title: "Two", pageNumber: 3 },
    { id: "chapter-2", title: "Three", pageNumber: 5 },
  ];

  it("highlights the latest chapter at or before the current page", () => {
    expect(activeChapterId(chapters, 1)).toBe("chapter-0");
    expect(activeChapterId(chapters, 2)).toBe("chapter-0");
    expect(activeChapterId(chapters, 3)).toBe("chapter-1");
    expect(activeChapterId(chapters, 5)).toBe("chapter-2");
  });
});
