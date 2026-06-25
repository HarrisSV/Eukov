import { describe, expect, it, vi } from "vitest";
import { applyChapterHeadingStyles } from "@/lib/chapter-heading-styles";
import type { DocxEditorRef } from "@eigenpal/docx-editor-react";

function mockEditor(
  pages: Array<{ paragraphs: Array<{ paraId: string; text: string; styleId?: string }> }>,
): DocxEditorRef {
  const setParagraphStyle = vi.fn(() => true);

  return {
    getTotalPages: () => pages.length,
    getPageContent: (pageNumber: number) => {
      const page = pages[pageNumber - 1];
      if (!page) {
        return null;
      }
      return {
        pageNumber,
        text: page.paragraphs.map((paragraph) => paragraph.text).join("\n"),
        paragraphs: page.paragraphs,
      };
    },
    setParagraphStyle,
  } as unknown as DocxEditorRef;
}

describe("applyChapterHeadingStyles", () => {
  it("applies Heading1 to chapter lines and markdown headings", () => {
    const editor = mockEditor([
      {
        paragraphs: [
          { paraId: "p1", text: "Chapter 1" },
          { paraId: "p2", text: "Lorem ipsum dolor sit amet." },
          { paraId: "p3", text: "# Chapter 2" },
        ],
      },
    ]);

    const updated = applyChapterHeadingStyles(editor);

    expect(updated).toBe(2);
    expect(editor.setParagraphStyle).toHaveBeenCalledWith({ paraId: "p1", styleId: "Heading1" });
    expect(editor.setParagraphStyle).toHaveBeenCalledWith({ paraId: "p3", styleId: "Heading1" });
    expect(editor.setParagraphStyle).not.toHaveBeenCalledWith(
      expect.objectContaining({ paraId: "p2" }),
    );
  });

  it("skips paragraphs that already use a heading style", () => {
    const editor = mockEditor([
      {
        paragraphs: [{ paraId: "p1", text: "Chapter 1", styleId: "Heading1" }],
      },
    ]);

    expect(applyChapterHeadingStyles(editor)).toBe(0);
    expect(editor.setParagraphStyle).not.toHaveBeenCalled();
  });
});
