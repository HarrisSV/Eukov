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
      {
        title: "Local title",
        content: "<p>" + "word ".repeat(500) + "</p>",
        updatedAt: Date.now(),
      },
    );

    expect(resolved.title).toBe("Local title");
    expect(resolved.content).toContain("word");
  });

  it("prefers server when it has more content", () => {
    const resolved = resolveDraftContent(
      "Server title",
      "<p>" + "server ".repeat(500) + "</p>",
      {
        title: "Local title",
        content: "<p>tiny</p>",
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
      shouldWriteDraftCheckpoint("doc-1", "Untitled draft", ""),
    ).toBe(false);
    expect(
      shouldWriteDraftCheckpoint("doc-1", "Untitled draft", "<p></p>"),
    ).toBe(false);
  });

  it("writes checkpoints when draft has content", () => {
    expect(
      shouldWriteDraftCheckpoint("doc-1", "My draft", "<p>hello</p>"),
    ).toBe(true);
  });
});
