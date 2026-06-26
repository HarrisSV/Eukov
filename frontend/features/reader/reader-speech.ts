import { htmlToPlainText } from "@/features/reader/page-content";

export interface SpeechSegment {
  pageNumber: number;
  text: string;
  startChar: number;
  endChar: number;
}

export interface SpeechScript {
  text: string;
  segments: SpeechSegment[];
}

export function buildSpeechScript(
  pages: Array<{ pageNumber: number; content: string }>,
  fromPage: number,
): SpeechScript {
  const ordered = pages
    .filter((page) => page.pageNumber >= fromPage)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  let text = "";
  const segments: SpeechSegment[] = [];

  for (const page of ordered) {
    const pageText = htmlToPlainText(page.content);
    if (!pageText) {
      continue;
    }

    if (text.length > 0) {
      text += "\n\n";
    }

    const startChar = text.length;
    text += pageText;
    segments.push({
      pageNumber: page.pageNumber,
      text: pageText,
      startChar,
      endChar: text.length,
    });
  }

  return { text, segments };
}

export function pageForCharIndex(segments: SpeechSegment[], charIndex: number): number {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (charIndex >= segments[index].startChar) {
      return segments[index].pageNumber;
    }
  }
  return segments[0]?.pageNumber ?? 1;
}

export function segmentForPage(
  segments: SpeechSegment[],
  pageNumber: number,
): SpeechSegment | undefined {
  return segments.find((segment) => segment.pageNumber === pageNumber);
}

export function localCharIndex(segment: SpeechSegment, globalCharIndex: number): number {
  return globalCharIndex - segment.startChar;
}

export function nextWordStart(text: string, fromIndex: number): number {
  let index = Math.max(0, fromIndex);
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }
  return index;
}

export function wordRangeAt(text: string, charIndex: number): { start: number; end: number } {
  const clamped = Math.max(0, Math.min(charIndex, text.length));
  let start = clamped;
  while (start > 0 && /\S/.test(text[start - 1])) {
    start -= 1;
  }

  let end = clamped;
  while (end < text.length && /\S/.test(text[end])) {
    end += 1;
  }

  return { start, end };
}

export function resumeCharIndexForNextWord(text: string, globalCharIndex: number): number {
  const { end } = wordRangeAt(text, globalCharIndex);
  return nextWordStart(text, end);
}

export function nextSegment(
  segments: SpeechSegment[],
  pageNumber: number,
): SpeechSegment | undefined {
  const index = segments.findIndex((segment) => segment.pageNumber === pageNumber);
  if (index < 0) {
    return undefined;
  }
  return segments[index + 1];
}

export function isPageVisible(
  pageNumber: number,
  leftPage: number,
  rightPage: number | null,
): boolean {
  if (pageNumber === leftPage) {
    return true;
  }
  return rightPage != null && pageNumber === rightPage;
}
