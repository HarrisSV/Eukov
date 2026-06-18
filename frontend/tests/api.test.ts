import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, formatGenreLabel, formatRoleLabel } from "@/services/api";

describe("formatGenreLabel", () => {
  it("capitalizes genre names", () => {
    expect(formatGenreLabel("philosophy")).toBe("Philosophy");
  });
});

describe("formatRoleLabel", () => {
  it("formats role names", () => {
    expect(formatRoleLabel("SUPER_ADMIN")).toBe("Super Admin");
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

    const result = await api.register({
      email: "reader@example.com",
      password: "password123",
      firstName: "Reader",
      lastName: "Example",
      nickname: "reader",
    });
    expect(result.success).toBe(true);
  });

  it("calls login endpoint with tokens", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          accessToken: "access",
          refreshToken: "refresh",
          user: { id: "u-1", email: "reader@example.com", role: "READER" },
        }),
      }),
    );

    const result = await api.login("reader@example.com", "password123");
    expect(result.accessToken).toBe("access");
    expect(result.user.role).toBe("READER");
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
});
