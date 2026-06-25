import { escapeHtml } from "@/lib/document-import";
import { stripFullWidthImageStyles } from "@/lib/image-fit";

/** Lines like "Chapter 1", "Chapter 2", "Part III" treated as h1 chapter headings. */
const CHAPTER_HEADING =
  /^(?:chapter|part|section|book)\s+[\divxlcdm]+[\s.:–-]*$|^chapter\s+\d+[\s.:–-]*$/i;

const HEADING_BLOCK = /^<(h[1-6]|p[^>]*data-eukov-heading)/i;
const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/;
/** Blank paragraph html-to-docx preserves as vertical gap between blocks. */
const BLOCK_SPACER = "<p></p>";

function joinStructuredBlocks(blocks: string[]): string {
  if (blocks.length === 0) {
    return "<p></p>";
  }
  return blocks.join(BLOCK_SPACER);
}

export function isChapterHeadingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) {
    return false;
  }
  return CHAPTER_HEADING.test(trimmed);
}

export function parseMarkdownHeadingLine(line: string): { level: number; text: string } | null {
  const match = line.trim().match(MARKDOWN_HEADING);
  if (!match) {
    return null;
  }
  return { level: match[1]!.length, text: match[2]!.trim() };
}

function paragraphHtml(text: string, indentLevel = 0): string {
  const style = indentLevel > 0 ? ` style="margin-left: ${indentLevel * 2}em"` : "";
  return `<p${style}>${escapeHtml(text).replace(/\r?\n/g, "<br>")}</p>`;
}

/** Semantic headings: html-to-docx maps h1–h6 to Word Heading styles; paste uses post-paste fix. */
function headingParagraphHtml(text: string, level = 1): string {
  const clamped = Math.min(6, Math.max(1, level));
  const tag = `h${clamped}`;
  return `<${tag}>${escapeHtml(text)}</${tag}>`;
}

function hasStructuredPlainText(trimmedPlain: string): boolean {
  if (!trimmedPlain) {
    return false;
  }
  if (trimmedPlain.includes("\n\n")) {
    return true;
  }
  return trimmedPlain.split("\n").some((line) => {
    const trimmed = line.trim();
    return MARKDOWN_HEADING.test(trimmed) || isChapterHeadingLine(trimmed);
  });
}

function htmlBlocksFromStructured(html: string): string[] {
  if (typeof document === "undefined") {
    return [html];
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.body.children).map((node) => node.outerHTML);
}

function elementTextWithBreaks(el: HTMLElement): string {
  return (el.innerHTML || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n");
}

function pushPlainTextBlocks(blocks: string[], text: string) {
  blocks.push(...htmlBlocksFromStructured(plainTextToStructuredHtml(text)));
}

function parseMarkdownHeading(line: string): { level: number; text: string } | null {
  return parseMarkdownHeadingLine(line);
}

function isDocxEditorPaste(html: string): boolean {
  return (
    html.includes("data-docx-editor") ||
    html.includes("docx-run") ||
    html.includes("docx-paragraph")
  );
}

function isWordPaste(html: string): boolean {
  return (
    html.includes("urn:schemas-microsoft-com:office") ||
    html.includes("mso-") ||
    html.includes("MsoNormal") ||
    html.includes('class="Mso')
  );
}

export function shouldEnhancePaste(event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items) {
    return true;
  }
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item?.kind === "file" && item.type.startsWith("image/")) {
      return false;
    }
  }
  return true;
}

/**
 * Normalize clipboard HTML/plain text for docx-editor paste.
 * Returns null when the default paste path should run unchanged.
 */
export function prepareStructuredPasteHtml(html: string, plain: string): string | null {
  const trimmedPlain = plain.replace(/\r\n/g, "\n").trim();
  const trimmedHtml = html.trim();

  if (isDocxEditorPaste(trimmedHtml) || isWordPaste(trimmedHtml)) {
    return null;
  }

  if (!trimmedPlain && !trimmedHtml) {
    return null;
  }

  if (hasStructuredPlainText(trimmedPlain) || !trimmedHtml) {
    return plainTextToStructuredHtml(plain);
  }

  return normalizePastedHtml(trimmedHtml);
}

function countLeadingIndent(line: string): number {
  const match = line.match(/^(\t+| +)/);
  if (!match) {
    return 0;
  }
  return match[1].includes("\t")
    ? match[1].length
    : Math.floor(match[1].length / 2);
}

/**
 * Converts pasted plain text into semantic HTML, preserving chapter headings
 * and paragraph breaks from single- or double-newline sources.
 */
export function plainTextToStructuredHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "<p></p>";
  }

  const blocks: string[] = [];
  const sections = normalized.split(/\n\s*\n+/);

  for (const section of sections) {
    const rawLines = section.split("\n");
    const lines = rawLines.map((line) => line.trimEnd()).filter((line) => line.trim());

    if (lines.length === 0) {
      continue;
    }

    const firstTrimmed = lines[0].trim();
    const markdownHeading = parseMarkdownHeading(firstTrimmed);
    if (markdownHeading) {
      blocks.push(headingParagraphHtml(markdownHeading.text, markdownHeading.level));
      if (lines.length > 1) {
        const body = lines.slice(1).join(" ").trim();
        if (body) {
          blocks.push(paragraphHtml(body));
        }
      }
      continue;
    }

    if (isChapterHeadingLine(firstTrimmed)) {
      blocks.push(headingParagraphHtml(firstTrimmed));
      if (lines.length > 1) {
        const body = lines.slice(1).join(" ").trim();
        if (body) {
          blocks.push(paragraphHtml(body));
        }
      }
      continue;
    }

    const indent = countLeadingIndent(rawLines[0] ?? "");
    blocks.push(paragraphHtml(lines.join(" "), indent));
  }

  return joinStructuredBlocks(blocks);
}

function isHeadingBlockHtml(blockHtml: string): boolean {
  return HEADING_BLOCK.test(blockHtml.trim());
}

export function isHeadingBlock(blockHtml: string): boolean {
  return isHeadingBlockHtml(blockHtml);
}

/** Strip clipboard HTML down to editor-safe blocks while keeping headings and images. */
export function normalizePastedHtml(html: string): string {
  if (typeof document === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
        const level = Number.parseInt(tag[1]!, 10);
        const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (text) {
          blocks.push(headingParagraphHtml(text, level));
        }
        return;
      }

      if (tag === "p") {
        const text = elementTextWithBreaks(el).trim();
        if (hasStructuredPlainText(text)) {
          pushPlainTextBlocks(blocks, text);
          return;
        }

        const markdownHeading = parseMarkdownHeading(text.replace(/\n/g, " "));
        if (markdownHeading) {
          blocks.push(headingParagraphHtml(markdownHeading.text, markdownHeading.level));
          return;
        }

        if (isChapterHeadingLine(text.replace(/\n/g, " "))) {
          blocks.push(headingParagraphHtml(text.replace(/\n/g, " ")));
          return;
        }

        blocks.push(el.outerHTML);
        return;
      }

      if (tag === "img") {
        const cleaned = stripFullWidthImageStyles(el.outerHTML);
        blocks.push(`<p>${cleaned}</p>`);
        return;
      }

      if (tag === "ul" || tag === "ol" || tag === "blockquote") {
        blocks.push(el.outerHTML);
        return;
      }

      if (tag === "div" || tag === "body" || tag === "article" || tag === "section") {
        for (const child of Array.from(el.childNodes)) {
          walk(child);
        }
        return;
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (text) {
        if (isChapterHeadingLine(text)) {
          blocks.push(headingParagraphHtml(text));
        } else {
          blocks.push(paragraphHtml(text));
        }
      }
    }
  };

  walk(doc.body);

  return joinStructuredBlocks(blocks);
}
