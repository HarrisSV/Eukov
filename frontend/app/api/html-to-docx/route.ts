import HTMLtoDOCX from "html-to-docx";
import { NextResponse } from "next/server";
import { sanitizeHtmlForDocx } from "@/lib/docx-content";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let html: string;
    if (contentType.includes("text/html")) {
      html = sanitizeHtmlForDocx((await request.text()).trim());
    } else {
      const body = (await request.json()) as { html?: string };
      html = sanitizeHtmlForDocx(body.html?.trim() ?? "");
    }
    if (!html) {
      return NextResponse.json({ error: "No HTML provided" }, { status: 400 });
    }

    const docx = await HTMLtoDOCX(html, null, {
      table: { row: { cantSplit: true } },
      footer: false,
      header: false,
    });

    const buffer = Buffer.isBuffer(docx) ? docx : Buffer.from(docx as ArrayBuffer);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not convert HTML to DOCX.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
