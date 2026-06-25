export type DocumentContentFormat = "docx" | "html";

export function looksLikeHtmlContent(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return (
    trimmed.startsWith("<") ||
    trimmed.includes('data-type="page-sheet"') ||
    trimmed.includes('class="draft-page-sheet"')
  );
}

export function isValidBase64(value: string): boolean {
  if (!value || looksLikeHtmlContent(value)) {
    return false;
  }

  const normalized = value.replace(/\s/g, "");
  if (!normalized || normalized.length % 4 !== 0) {
    return false;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    return false;
  }

  // Full atob on multi-MB strings blocks the main thread; sample-check small payloads only.
  if (normalized.length > 256_000) {
    return true;
  }

  try {
    atob(normalized);
    return true;
  } catch {
    return false;
  }
}

export function normalizeEditorContent(
  content: string,
  contentFormat: DocumentContentFormat,
): { content: string; contentFormat: DocumentContentFormat } {
  if (!content) {
    return { content, contentFormat };
  }

  if (looksLikeHtmlContent(content)) {
    return { content, contentFormat: "html" };
  }

  if (contentFormat === "docx" && !isValidBase64(content)) {
    return { content, contentFormat: "html" };
  }

  return { content, contentFormat };
}

export function sanitizeHtmlForDocx(html: string): string {
  return html
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[\uFFFE\uFFFF]/g, "");
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

/** Non-blocking decode for large DOCX payloads stored as base64. */
export async function base64ToArrayBufferAsync(base64: string): Promise<ArrayBuffer> {
  const normalized = base64.replace(/\s/g, "");
  if (normalized.length <= 512_000) {
    return base64ToArrayBuffer(normalized);
  }
  const response = await fetch(`data:application/octet-stream;base64,${normalized}`);
  return response.arrayBuffer();
}

export function isEmptyHtmlContent(html: string): boolean {
  const trimmed = html.trim();
  return !trimmed || trimmed === "<p></p>";
}

export async function docxBufferToReaderHtml(buffer: ArrayBuffer): Promise<string> {
  const response = await fetch("/api/docx-to-html", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: buffer,
  });
  const data = (await response.json()) as { html?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Could not convert document for reading.");
  }
  return data.html?.trim() || "<p></p>";
}

/** Best-effort reader HTML; returns undefined when conversion fails. */
export async function tryDocxBufferToReaderHtml(
  buffer: ArrayBuffer,
): Promise<string | undefined> {
  try {
    return await docxBufferToReaderHtml(buffer);
  } catch {
    return undefined;
  }
}

export async function htmlToDocxBuffer(html: string): Promise<ArrayBuffer> {
  const sanitized = sanitizeHtmlForDocx(html);
  const response = await fetch("/api/html-to-docx", {
    method: "POST",
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: sanitized,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Could not migrate legacy draft.");
  }
  return response.arrayBuffer();
}
