export const IMPORT_ACCEPT =
  ".doc,.docx,.pdf,.txt,.md,.csv,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg," +
  "application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/pdf,text/plain,text/markdown,text/html,text/csv,image/*";

export type ImportFileKind =
  | "image"
  | "text"
  | "markdown"
  | "html"
  | "doc"
  | "docx"
  | "pdf"
  | "csv"
  | "unsupported";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
]);

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function bodyToHtml(body: string): string {
  const paragraphs = body
    .split(/\r?\n\r?\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return "<p></p>";
  }
  return paragraphs
    .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index === -1 ? "" : fileName.slice(index).toLowerCase();
}

export function classifyImportFile(file: File): ImportFileKind {
  const ext = getFileExtension(file.name);
  const mime = file.type.toLowerCase();

  if (IMAGE_EXTENSIONS.has(ext) || mime.startsWith("image/")) {
    return "image";
  }
  if (ext === ".pdf" || mime === "application/pdf") {
    return "pdf";
  }
  if (ext === ".doc" || mime === "application/msword") {
    return "doc";
  }
  if (
    ext === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (ext === ".md" || mime === "text/markdown") {
    return "markdown";
  }
  if (ext === ".html" || ext === ".htm" || mime === "text/html") {
    return "html";
  }
  if (ext === ".csv" || mime === "text/csv") {
    return "csv";
  }
  if (ext === ".txt" || mime.startsWith("text/")) {
    return "text";
  }
  return "unsupported";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export async function imageFileToHtml(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const alt = escapeHtml(file.name);
  return `<p><img src="${dataUrl}" alt="${alt}" /></p>`;
}

export async function textFileToHtml(file: File): Promise<string> {
  return bodyToHtml(await file.text());
}

export async function htmlFileToHtml(file: File): Promise<string> {
  const raw = await file.text();
  const trimmed = raw.trim();
  return trimmed || "<p></p>";
}

export async function importFileOnClient(file: File): Promise<string> {
  const kind = classifyImportFile(file);

  switch (kind) {
    case "image":
      return imageFileToHtml(file);
    case "text":
    case "markdown":
    case "csv":
      return textFileToHtml(file);
    case "html":
      return htmlFileToHtml(file);
    case "doc":
    case "docx":
    case "pdf":
      return importFileViaApi(file);
    default:
      throw new Error(
        `Unsupported file type (${file.name}). Try .doc, .docx, .pdf, images, or plain text.`,
      );
  }
}

export async function importFileViaApi(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/import-document", {
    method: "POST",
    body: form,
  });
  const data = (await response.json()) as { html?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Import failed");
  }
  return data.html ?? "<p></p>";
}
