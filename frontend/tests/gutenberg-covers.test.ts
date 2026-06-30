import { describe, expect, it } from "vitest";
import {
  buildGutenbergSourceCoverDataUrl,
  gutenbergCoverUrl,
  parseGutenbergIdFromTags,
  resolveLibraryCoverCandidates,
} from "@/lib/gutenberg-covers";

describe("gutenberg-covers", () => {
  it("parses gutenberg id from tags", () => {
    expect(parseGutenbergIdFromTags(["public-domain", "gutenberg", "gutenberg-27015"])).toBe(
      27015,
    );
    expect(parseGutenbergIdFromTags(["literature"])).toBeNull();
  });

  it("builds gutenberg cache cover url", () => {
    expect(gutenbergCoverUrl(34030)).toBe(
      "https://www.gutenberg.org/cache/epub/34030/pg34030.cover.medium.jpg",
    );
  });

  it("includes gutenberg cache and generated fallback for seeded books", () => {
    const candidates = resolveLibraryCoverCandidates({
      title: "Turning and Boring",
      authorName: "Franklin Day Jones",
      genreName: "technology",
      tags: ["gutenberg", "gutenberg-34030", "public-domain"],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toContain("gutenberg.org/cache/epub/34030");
    expect(candidates[1]).toContain("data:image/svg+xml");
    expect(decodeURIComponent(candidates[1])).toContain("PROJECT GUTENBERG");
  });

  it("generates branded source cover svg", () => {
    const dataUrl = buildGutenbergSourceCoverDataUrl({
      title: "Sample Book",
      authorName: "Author Name",
      genreName: "history",
      gutenbergId: 123,
    });

    expect(dataUrl.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(dataUrl)).toContain("Seeded from gutenberg.org");
    expect(decodeURIComponent(dataUrl)).toContain("#123");
  });
});
