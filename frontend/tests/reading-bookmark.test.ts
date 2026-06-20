import { describe, expect, it, beforeEach } from "vitest";
import {
  readReadingBookmark,
  writeReadingBookmark,
  clearReadingBookmark,
} from "@/lib/reading-bookmark";

describe("reading bookmark storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("writes and reads a bookmark for a document", () => {
    writeReadingBookmark({
      documentId: "doc-1",
      page: 2,
      anchorText: "lorem ipsum",
      charOffset: 42,
      savedAt: Date.now(),
    });

    const bookmark = readReadingBookmark("doc-1");
    expect(bookmark?.page).toBe(2);
    expect(bookmark?.anchorText).toBe("lorem ipsum");
    expect(bookmark?.charOffset).toBe(42);
  });

  it("clears a saved bookmark", () => {
    writeReadingBookmark({
      documentId: "doc-1",
      page: 3,
      savedAt: Date.now(),
    });
    clearReadingBookmark("doc-1");
    expect(readReadingBookmark("doc-1")).toBeNull();
  });
});
