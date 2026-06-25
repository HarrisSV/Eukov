import { describe, expect, it } from "vitest";
import {
  EDITOR_PAGE_CONTENT_HEIGHT_PX,
  EDITOR_PAGE_CONTENT_WIDTH_PX,
  clampImageDimensions,
  fitImageDimensions,
  normalizeImageDimensions,
  resizeImageKeepingAspect,
  resizeImageKeepingAspectByHeight,
} from "@/lib/image-fit";

describe("fitImageDimensions", () => {
  it("keeps small images at their natural pixel size", () => {
    expect(fitImageDimensions(240, 180)).toEqual({ width: 240, height: 180 });
  });

  it("scales wide images down to the editor page width", () => {
    const fitted = fitImageDimensions(2400, 1350, EDITOR_PAGE_CONTENT_WIDTH_PX);
    expect(fitted.width).toBe(EDITOR_PAGE_CONTENT_WIDTH_PX);
    expect(fitted.height).toBe(Math.round(1350 * (EDITOR_PAGE_CONTENT_WIDTH_PX / 2400)));
  });

  it("scales tall images down to the editor page height", () => {
    const fitted = fitImageDimensions(800, 2400, EDITOR_PAGE_CONTENT_WIDTH_PX, EDITOR_PAGE_CONTENT_HEIGHT_PX);
    expect(fitted.height).toBeLessThanOrEqual(EDITOR_PAGE_CONTENT_HEIGHT_PX);
    expect(fitted.width).toBeLessThanOrEqual(EDITOR_PAGE_CONTENT_WIDTH_PX);
  });
});

describe("clampImageDimensions", () => {
  it("clamps oversized pasted dimensions to the page box", () => {
    const clamped = clampImageDimensions(3000, 4000);
    expect(clamped.width).toBeLessThanOrEqual(EDITOR_PAGE_CONTENT_WIDTH_PX);
    expect(clamped.height).toBeLessThanOrEqual(EDITOR_PAGE_CONTENT_HEIGHT_PX);
  });
});

describe("resizeImageKeepingAspect", () => {
  it("preserves the natural aspect ratio while resizing", () => {
    const resized = resizeImageKeepingAspect(400, 1600, 900);
    expect(resized.width).toBe(400);
    expect(resized.height).toBe(225);
  });
});

describe("resizeImageKeepingAspectByHeight", () => {
  it("preserves the natural aspect ratio when height drives the resize", () => {
    const resized = resizeImageKeepingAspectByHeight(225, 1600, 900);
    expect(resized.height).toBe(225);
    expect(resized.width).toBe(400);
  });
});

describe("normalizeImageDimensions", () => {
  it("repairs mismatched width/height pairs from bad resize state", () => {
    const normalized = normalizeImageDimensions(500, 120, 1600, 900);
    expect(normalized.width).toBe(500);
    expect(normalized.height).toBe(281);
  });
});
