import {
  isEmptyHtmlContent,
  normalizeEditorContent,
  type DocumentContentFormat,
} from "@/lib/docx-content";

const NEW_DRAFT_KEY = "eukov-draft-new";

function draftKey(documentId: string) {
  return `eukov-draft-${documentId}`;
}

export type DraftCheckpoint = {
  title: string;
  content: string;
  contentFormat: DocumentContentFormat;
  readerHtml?: string;
  updatedAt: number;
};

function normalizeCheckpoint(parsed: Partial<DraftCheckpoint>): DraftCheckpoint | null {
  if (typeof parsed.title !== "string" || typeof parsed.content !== "string") {
    return null;
  }
  const contentFormat =
    parsed.contentFormat === "docx" || parsed.contentFormat === "html"
      ? parsed.contentFormat
      : "html";

  const normalized = normalizeEditorContent(parsed.content, contentFormat);

  return {
    title: parsed.title,
    content: normalized.content,
    contentFormat: normalized.contentFormat,
    readerHtml: typeof parsed.readerHtml === "string" ? parsed.readerHtml : undefined,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
  };
}

export function readDraftCheckpoint(documentId?: string): DraftCheckpoint | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = documentId ? draftKey(documentId) : NEW_DRAFT_KEY;
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    return normalizeCheckpoint(JSON.parse(raw) as Partial<DraftCheckpoint>);
  } catch {
    return null;
  }
}

export function writeDraftCheckpoint(
  documentId: string | undefined,
  title: string,
  content: string,
  contentFormat: DocumentContentFormat = "docx",
  readerHtml?: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: DraftCheckpoint = {
    title,
    content,
    contentFormat,
    readerHtml,
    updatedAt: Date.now(),
  };
  const key = documentId ? draftKey(documentId) : NEW_DRAFT_KEY;
  localStorage.setItem(key, JSON.stringify(payload));
}

export function clearDraftCheckpoint(documentId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (documentId) {
    localStorage.removeItem(draftKey(documentId));
    return;
  }
  localStorage.removeItem(NEW_DRAFT_KEY);
}

export function migrateDraftCheckpoint(fromId: string | undefined, toId: string) {
  const checkpoint = readDraftCheckpoint(fromId);
  if (!checkpoint) {
    return;
  }
  writeDraftCheckpoint(
    toId,
    checkpoint.title,
    checkpoint.content,
    checkpoint.contentFormat,
    checkpoint.readerHtml,
  );
  clearDraftCheckpoint(fromId);
}

function contentWordCount(content: string, contentFormat: DocumentContentFormat): number {
  if (contentFormat === "html") {
    const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text ? text.split(" ").length : 0;
  }
  // DOCX is stored as base64 — approximate manuscript size without decoding.
  return content.length > 48 ? Math.max(500, Math.floor(content.length / 48)) : 0;
}

/** Prefer whichever source has more written content (server vs local checkpoint). */
export function resolveDraftContent(
  serverTitle: string,
  serverContent: string,
  serverFormat: DocumentContentFormat,
  serverReaderHtml: string | undefined,
  checkpoint: DraftCheckpoint | null,
): {
  title: string;
  content: string;
  contentFormat: DocumentContentFormat;
  readerHtml?: string;
} {
  if (
    checkpoint &&
    checkpoint.contentFormat === "docx" &&
    checkpoint.content.length > 48 &&
    serverFormat === "html"
  ) {
    return {
      title: checkpoint.title || serverTitle,
      content: checkpoint.content,
      contentFormat: checkpoint.contentFormat,
      readerHtml: checkpoint.readerHtml ?? serverReaderHtml,
    };
  }

  const serverWords = contentWordCount(serverContent, serverFormat);
  const checkpointWords = checkpoint
    ? contentWordCount(checkpoint.content, checkpoint.contentFormat)
    : 0;

  if (checkpoint && checkpointWords > serverWords) {
    return {
      title: checkpoint.title || serverTitle,
      content: checkpoint.content,
      contentFormat: checkpoint.contentFormat,
      readerHtml: checkpoint.readerHtml,
    };
  }

  return {
    title: serverTitle,
    content: serverContent,
    contentFormat: serverFormat,
    readerHtml: serverReaderHtml,
  };
}

export function shouldWriteDraftCheckpoint(
  documentId: string | undefined,
  title: string,
  content: string,
  contentFormat: DocumentContentFormat,
): boolean {
  const hasContent =
    contentFormat === "docx" ? content.length > 48 : !isEmptyHtmlContent(content);
  const hasTitle = Boolean(title.trim()) && title.trim() !== "Untitled draft";

  if (!documentId) {
    return hasContent || hasTitle;
  }

  return hasContent;
}
