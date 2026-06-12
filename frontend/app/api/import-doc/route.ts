import WordExtractor from "word-extractor";
import { NextResponse } from "next/server";

const DOC_MIME = "application/msword";
const DOC_EXT = ".doc";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bodyToHtml(body: string): string {
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

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(DOC_EXT)) {
      return NextResponse.json(
        { error: "Only .doc files are supported. Save as Word 97-2003 (.doc) and try again." },
        { status: 400 },
      );
    }

    if (file.type && file.type !== DOC_MIME && file.type !== "application/octet-stream") {
      return NextResponse.json(
        { error: "Invalid file type. Only .doc format is accepted." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const html = bodyToHtml(doc.getBody());

    return NextResponse.json({ html });
  } catch {
    return NextResponse.json(
      { error: "Could not read this .doc file. Ensure it is a valid Word 97-2003 document." },
      { status: 422 },
    );
  }
}
