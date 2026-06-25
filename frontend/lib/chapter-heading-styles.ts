import type { DocxEditorRef } from "@eigenpal/docx-editor-react";
import type { RefObject } from "react";
import { isChapterHeadingLine, parseMarkdownHeadingLine } from "@/lib/paste-html";

function isHeadingParagraphText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return isChapterHeadingLine(trimmed) || parseMarkdownHeadingLine(trimmed) !== null;
}

function isAlreadyHeading(styleId?: string): boolean {
  if (!styleId) {
    return false;
  }
  return /^heading\s*[1-6]$/i.test(styleId) || /^Heading[1-6]$/.test(styleId);
}

/** Apply Word Heading 1 to chapter title paragraphs (docx-editor paste ignores h1/styles). */
export function applyChapterHeadingStyles(editor: DocxEditorRef): number {
  const totalPages = editor.getTotalPages();
  if (totalPages <= 0) {
    return 0;
  }

  let updated = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    const content = editor.getPageContent(page);
    if (!content) {
      continue;
    }

    for (const paragraph of content.paragraphs) {
      const text = paragraph.text.trim();
      if (!text || isAlreadyHeading(paragraph.styleId)) {
        continue;
      }

      if (!isHeadingParagraphText(text)) {
        continue;
      }

      if (editor.setParagraphStyle({ paraId: paragraph.paraId, styleId: "Heading1" })) {
        updated += 1;
      }
    }
  }

  return updated;
}

export function scheduleChapterHeadingStyles(editorRef: RefObject<DocxEditorRef | null>): void {
  let attempts = 0;

  const tryApply = () => {
    const editor = editorRef.current;
    if (!editor) {
      if (attempts < 40) {
        attempts += 1;
        window.setTimeout(tryApply, 50);
      }
      return;
    }

    const totalPages = editor.getTotalPages();
    if (totalPages <= 0 && attempts < 40) {
      attempts += 1;
      window.setTimeout(tryApply, 50);
      return;
    }

    applyChapterHeadingStyles(editor);
  };

  window.requestAnimationFrame(tryApply);
}
