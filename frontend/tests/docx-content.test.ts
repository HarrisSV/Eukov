import { describe, expect, it, vi, afterEach } from "vitest";
import { tryDocxBufferToReaderHtml } from "@/lib/docx-content";

describe("tryDocxBufferToReaderHtml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined when conversion fails instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Cannot read properties of undefined (reading 'charAt')" }),
      }),
    );

    const result = await tryDocxBufferToReaderHtml(new ArrayBuffer(8));
    expect(result).toBeUndefined();
  });

  it("returns html when conversion succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ html: "<p>Hello</p>" }),
      }),
    );

    const result = await tryDocxBufferToReaderHtml(new ArrayBuffer(8));
    expect(result).toBe("<p>Hello</p>");
  });
});
