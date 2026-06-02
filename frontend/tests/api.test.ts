import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, formatGenreLabel } from "@/services/api";

describe("formatGenreLabel", () => {
  it("capitalizes genre names", () => {
    expect(formatGenreLabel("philosophy")).toBe("Philosophy");
    expect(formatGenreLabel("history")).toBe("History");
  });
});

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls register endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, userId: "u-1" }),
      }),
    );

    const result = await api.register("reader@example.com", "password123");
    expect(result.success).toBe(true);
  });

  it("calls login endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, userId: "u-1", email: "reader@example.com" }),
      }),
    );

    const result = await api.login("reader@example.com", "password123");
    expect(result.email).toBe("reader@example.com");
  });

  it("throws ApiError on failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid email or password" }),
      }),
    );

    await expect(api.login("reader@example.com", "wrong-pass")).rejects.toBeInstanceOf(ApiError);
  });

  it("fetches and saves preferences", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ genres: [{ id: "1", name: "history" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ genres: ["history"] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const genres = await api.getGenres();
    expect(genres.genres[0].name).toBe("history");
    await api.savePreferences("u-1", ["history"]);
    const prefs = await api.getPreferences("u-1");
    expect(prefs.genres).toContain("history");
  });
});
