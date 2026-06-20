import { describe, expect, it } from "vitest";
import {
  formatSpreadLabel,
  htmlToPlainText,
  isHtmlContent,
  leftPageForTarget,
  nextSpreadLeft,
  prevSpreadLeft,
  rightPageNumber,
  spreadLeftPages,
} from "@/features/reader/page-content";

describe("spread navigation", () => {
  it("pairs pages for a spread", () => {
    expect(rightPageNumber(1, 3)).toBe(2);
    expect(rightPageNumber(3, 3)).toBeNull();
  });

  it("advances and retreats by spread", () => {
    expect(nextSpreadLeft(1, 3)).toBe(3);
    expect(nextSpreadLeft(3, 3)).toBe(3);
    expect(prevSpreadLeft(3)).toBe(1);
    expect(prevSpreadLeft(1)).toBe(1);
  });

  it("formats spread labels", () => {
    expect(formatSpreadLabel(1, 3)).toBe("1-2");
    expect(formatSpreadLabel(3, 3)).toBe("3");
    expect(formatSpreadLabel(1, 2)).toBe("1-2");
  });

  it("lists spread starting pages", () => {
    expect(spreadLeftPages(3)).toEqual([1, 3]);
    expect(spreadLeftPages(4)).toEqual([1, 3]);
  });

  it("maps a target page to spread left page", () => {
    expect(leftPageForTarget(2, 3)).toBe(1);
    expect(leftPageForTarget(3, 3)).toBe(3);
  });
});

describe("htmlToPlainText", () => {
  it("detects and strips html content", () => {
    expect(isHtmlContent("<p>Hello</p>")).toBe(true);
    expect(htmlToPlainText('<p><span style="font-family: Georgia">Hello</span></p>')).toBe(
      "Hello",
    );
  });
});
