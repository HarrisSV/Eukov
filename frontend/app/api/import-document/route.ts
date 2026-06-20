import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import { NextResponse } from "next/server";
import {
  bodyToHtml,
  classifyImportFile,
  type ImportFileKind,
} from "@/lib/document-import";

export const runtime = "nodejs";

async function docToHtml(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return bodyToHtml(doc.getBody());
}

async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer });
  const html = result.value?.trim();
  return html || "<p></p>";
}

async function pdfToHtml(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const [textResult, imageResult] = await Promise.all([
      parser.getText(),
      parser.getImage({ imageDataUrl: true, imageThreshold: 24 }),
    ]);

    const parts: string[] = [];
    if (textResult.text.trim()) {
      parts.push(bodyToHtml(textResult.text));
    }

    for (const page of imageResult.pages) {
      for (const image of page.images) {
        if (image.dataUrl) {
          parts.push(
            `<p><img src="${image.dataUrl}" alt="Imported PDF image (page ${page.pageNumber})" /></p>`,
          );
        }
      }
    }

    return parts.length > 0 ? parts.join("") : "<p></p>";
  } finally {
    await parser.destroy();
  }
}

async function convertBuffer(kind: ImportFileKind, buffer: Buffer): Promise<string> {
  switch (kind) {
    case "doc":
      return docToHtml(buffer);
    case "docx":
      return docxToHtml(buffer);
    case "pdf":
      return pdfToHtml(buffer);
    default:
      throw new Error("Unsupported server import type");
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const kind = classifyImportFile(file);
    if (kind === "unsupported") {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use .doc, .docx, .pdf, images, .txt, .md, or .html.",
        },
        { status: 400 },
      );
    }

    if (kind === "image" || kind === "text" || kind === "markdown" || kind === "html" || kind === "csv") {
      return NextResponse.json(
        { error: "This file type should be imported in the browser." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const html = await convertBuffer(kind, buffer);
    return NextResponse.json({ html });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not import this file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
