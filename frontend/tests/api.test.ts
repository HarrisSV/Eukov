import { describe, expect, it } from "vitest";
import { formatGenreLabel } from "@/services/api";

describe("formatGenreLabel", () => {
  it("capitalizes genre names", () => {
    expect(formatGenreLabel("philosophy")).toBe("Philosophy");
    expect(formatGenreLabel("history")).toBe("History");
  });
});
