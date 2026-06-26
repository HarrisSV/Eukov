import { describe, expect, it } from "vitest";
import {
  buildSpeechScript,
  isPageVisible,
  nextSegment,
  nextWordStart,
  pageForCharIndex,
  resumeCharIndexForNextWord,
  wordRangeAt,
} from "@/features/reader/reader-speech";

describe("buildSpeechScript", () => {
  it("concatenates pages from the starting page onward", () => {
    const script = buildSpeechScript(
      [
        { pageNumber: 1, content: "Alpha page" },
        { pageNumber: 2, content: "<p>Beta page</p>" },
        { pageNumber: 3, content: "Gamma page" },
      ],
      2,
    );

    expect(script.text).toBe("Beta page\n\nGamma page");
    expect(script.segments).toHaveLength(2);
    expect(script.segments[0].pageNumber).toBe(2);
    expect(script.segments[1].startChar).toBe("Beta page\n\n".length);
  });
});

describe("pageForCharIndex", () => {
  it("maps character offsets back to page numbers", () => {
    const script = buildSpeechScript(
      [
        { pageNumber: 1, content: "One two" },
        { pageNumber: 2, content: "Three four" },
      ],
      1,
    );

    expect(pageForCharIndex(script.segments, 0)).toBe(1);
    expect(pageForCharIndex(script.segments, script.segments[1].startChar)).toBe(2);
  });
});

describe("word helpers", () => {
  it("finds the next word start after a completed word", () => {
    const text = "hello world again";
    expect(nextWordStart(text, wordRangeAt(text, 0).end)).toBe("hello ".length);
    expect(resumeCharIndexForNextWord(text, 0)).toBe("hello ".length);
  });
});

describe("nextSegment", () => {
  it("returns the following page segment", () => {
    const script = buildSpeechScript(
      [
        { pageNumber: 1, content: "One" },
        { pageNumber: 2, content: "Two" },
      ],
      1,
    );

    expect(nextSegment(script.segments, 1)?.pageNumber).toBe(2);
    expect(nextSegment(script.segments, 2)).toBeUndefined();
  });
});

describe("isPageVisible", () => {
  it("treats both spread pages as visible in double mode", () => {
    expect(isPageVisible(1, 1, 2)).toBe(true);
    expect(isPageVisible(2, 1, 2)).toBe(true);
    expect(isPageVisible(3, 1, 2)).toBe(false);
  });
});
