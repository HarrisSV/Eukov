import mammoth from "mammoth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ html: "<p></p>" });
    }

    const result = await mammoth.convertToHtml({ buffer });
    return NextResponse.json({ html: result.value?.trim() || "<p></p>" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not convert document.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
