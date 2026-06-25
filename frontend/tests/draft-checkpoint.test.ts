import { describe, expect, it } from "vitest";
import {
  resolveDraftContent,
  shouldWriteDraftCheckpoint,
} from "@/lib/draft-checkpoint";

describe("resolveDraftContent", () => {
  it("prefers checkpoint when it has more words than server", () => {
    const resolved = resolveDraftContent(
      "Server title",
      "<p>short</p>",
      "html",
      undefined,
      {
        title: "Local title",
        content: "<p>" + "word ".repeat(500) + "</p>",
        contentFormat: "html",
        updatedAt: Date.now(),
      },
    );

    expect(resolved.title).toBe("Local title");
    expect(resolved.content).toContain("word");
  });

  it("prefers migrated docx checkpoint over server html", () => {
    const docxContent = "UEsDB".padEnd(120, "A");
    const resolved = resolveDraftContent(
      "Server title",
      "<p>" + "server ".repeat(500) + "</p>",
      "html",
      "<p>reader</p>",
      {
        title: "Local title",
        content: docxContent,
        contentFormat: "docx",
        readerHtml: "<p>reader</p>",
        updatedAt: Date.now(),
      },
    );

    expect(resolved.contentFormat).toBe("docx");
    expect(resolved.content).toBe(docxContent);
    expect(resolved.title).toBe("Local title");
  });

  it("prefers server when it has more content", () => {
    const resolved = resolveDraftContent(
      "Server title",
      "<p>" + "server ".repeat(500) + "</p>",
      "html",
      undefined,
      {
        title: "Local title",
        content: "<p>tiny</p>",
        contentFormat: "html",
        updatedAt: Date.now(),
      },
    );

    expect(resolved.title).toBe("Server title");
    expect(resolved.content).toContain("server");
  });
});

describe("shouldWriteDraftCheckpoint", () => {
  it("does not write empty checkpoints for saved drafts", () => {
    expect(
      shouldWriteDraftCheckpoint("doc-1", "Untitled draft", "", "docx"),
    ).toBe(false);
    expect(
      shouldWriteDraftCheckpoint("doc-1", "Untitled draft", "<p></p>", "html"),
    ).toBe(false);
  });

  it("writes checkpoints when draft has content", () => {
    expect(
      shouldWriteDraftCheckpoint("doc-1", "My draft", "<p>hello</p>", "html"),
    ).toBe(true);
  });
});
