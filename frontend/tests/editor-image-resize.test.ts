import { describe, expect, it } from "vitest";
import { commitWordLikeResize } from "@/features/docket/editor-image-resize";

describe("commitWordLikeResize", () => {
  const base = { width: 400, height: 200, posX: 0, posY: 0 };
  const natural = { naturalWidth: 1600, naturalHeight: 900, maxWidth: 624, maxHeight: 840 };

  it("keeps width fixed when resizing from the bottom edge", () => {
    const result = commitWordLikeResize({
      direction: [0, 1],
      width: 400,
      height: 160,
      translateX: 0,
      translateY: 40,
      base,
      ...natural,
    });

    expect(result.width).toBe(400);
    expect(result.height).toBe(160);
    expect(result.posY).toBe(40);
  });

  it("keeps height fixed when resizing from the right edge", () => {
    const result = commitWordLikeResize({
      direction: [1, 0],
      width: 320,
      height: 200,
      translateX: 80,
      translateY: 0,
      base,
      ...natural,
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(200);
    expect(result.posX).toBe(80);
  });

  it("locks aspect ratio for corner resize", () => {
    const result = commitWordLikeResize({
      direction: [1, 1],
      width: 300,
      height: 180,
      translateX: 0,
      translateY: 20,
      base,
      ...natural,
    });

    expect(result.width).toBe(300);
    expect(result.height).toBe(Math.round(300 * (900 / 1600)));
  });
});
