import { describe, expect, it } from "vitest";
import {
  isChapterHeadingLine,
  plainTextToStructuredHtml,
  prepareStructuredPasteHtml,
} from "@/lib/paste-html";
import { paginateHtml } from "@/lib/paginate-html";

describe("plainTextToStructuredHtml", () => {
  it("turns chapter lines into semantic headings separate from body text", () => {
    const html = plainTextToStructuredHtml(
      "Chapter 1\nLorem ipsum dolor sit amet.\n\nUt enim ad minima veniam.",
    );

    expect(html).toContain("<h1>Chapter 1</h1>");
    expect(html).toContain("<p>Lorem ipsum dolor sit amet.</p>");
    expect(html).toContain("<p>Ut enim ad minima veniam.</p>");
    expect(html).toContain("<p></p>");
    expect(html).not.toContain("</h1><h1>");
  });

  it("turns markdown headings into semantic headings with spacing between blocks", () => {
    const html = plainTextToStructuredHtml(
      "# Chapter 1\n\nLorem ipsum dolor sit amet.\n\n## Chapter 2\n\nNulla facilisi.",
    );

    expect(html).toContain("<h1>Chapter 1</h1>");
    expect(html).toContain("<p>Lorem ipsum dolor sit amet.</p>");
    expect(html).toContain("<h2>Chapter 2</h2>");
    expect(html).toContain("<p>Nulla facilisi.</p>");
    expect(html).toContain("<p></p>");
  });

  it("detects chapter headings on their own", () => {
    expect(isChapterHeadingLine("Chapter 1")).toBe(true);
    expect(isChapterHeadingLine("Chapter 2")).toBe(true);
    expect(isChapterHeadingLine("Part II")).toBe(true);
    expect(isChapterHeadingLine("Regular paragraph text")).toBe(false);
  });
});

describe("prepareStructuredPasteHtml", () => {
  it("converts markdown plain text for docx-editor paste", () => {
    const html = prepareStructuredPasteHtml(
      "",
      "# Chapter 1\n\nLorem ipsum.\n\n# Chapter 2\n\nMore text.",
    );

    expect(html).toContain("<h1>Chapter 1</h1>");
    expect(html).toContain("<h1>Chapter 2</h1>");
    expect(html).toContain("<p>Lorem ipsum.</p>");
    expect(html).toContain("<p>More text.</p>");
  });

  it("normalizes web HTML headings into heading blocks", () => {
    const html = prepareStructuredPasteHtml(
      "<article><h1>Chapter 1</h1><p>Body text.</p></article>",
      "Chapter 1\nBody text.",
    );

    expect(html).toContain("<h1>Chapter 1</h1>");
    expect(html).toContain("<p>Body text.</p>");
  });

  it("converts paragraph tags that contain markdown chapter lines", () => {
    const html = prepareStructuredPasteHtml(
      "<p># Chapter 1</p><p>Lorem ipsum.</p><p># Chapter 2</p><p>More text.</p>",
      "# Chapter 1\n\nLorem ipsum.\n\n# Chapter 2\n\nMore text.",
    );

    expect(html).toContain("<h1>Chapter 1</h1>");
    expect(html).toContain("<h1>Chapter 2</h1>");
  });

  it("skips docx-editor internal paste", () => {
    const html = prepareStructuredPasteHtml(
      '<div data-docx-editor-content="[]">internal</div>',
      "plain",
    );

    expect(html).toBeNull();
  });
});

describe("paginateHtml with headings", () => {
  it("keeps chapter headings when paginating long pasted content", () => {
    const body = "word ".repeat(400);
    const html = plainTextToStructuredHtml(`Chapter 1\n${body}\n\nChapter 2\n${body}`);
    const paginated = paginateHtml(html);

    expect(paginated).toContain("<h1>Chapter 1</h1>");
    expect(paginated).toContain("<h1>Chapter 2</h1>");
  });
});
