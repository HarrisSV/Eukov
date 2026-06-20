import { countWordsInHtml } from "@/lib/paginate-html";

const NEW_DRAFT_KEY = "eukov-draft-new";

function draftKey(documentId: string) {
  return `eukov-draft-${documentId}`;
}

export type DraftCheckpoint = {
  title: string;
  content: string;
  updatedAt: number;
};

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
    const parsed = JSON.parse(raw) as DraftCheckpoint;
    if (typeof parsed.title !== "string" || typeof parsed.content !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraftCheckpoint(
  documentId: string | undefined,
  title: string,
  content: string,
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: DraftCheckpoint = {
    title,
    content,
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
  writeDraftCheckpoint(toId, checkpoint.title, checkpoint.content);
  clearDraftCheckpoint(fromId);
}

function isEmptyDraftHtml(html: string): boolean {
  const trimmed = html.trim();
  return !trimmed || trimmed === "<p></p>";
}

/** Prefer whichever source has more written content (server vs local checkpoint). */
export function resolveDraftContent(
  serverTitle: string,
  serverContent: string,
  checkpoint: DraftCheckpoint | null,
): { title: string; content: string } {
  const serverWords = countWordsInHtml(serverContent);
  const checkpointWords = checkpoint ? countWordsInHtml(checkpoint.content) : 0;

  if (checkpointWords > serverWords) {
    return {
      title: checkpoint.title || serverTitle,
      content: checkpoint.content,
    };
  }

  return {
    title: serverTitle,
    content: serverContent,
  };
}

export function shouldWriteDraftCheckpoint(
  documentId: string | undefined,
  title: string,
  content: string,
): boolean {
  const hasContent = !isEmptyDraftHtml(content);
  const hasTitle = Boolean(title.trim()) && title.trim() !== "Untitled draft";

  if (!documentId) {
    return hasContent || hasTitle;
  }

  return hasContent;
}
