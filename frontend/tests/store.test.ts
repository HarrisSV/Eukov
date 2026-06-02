import { describe, expect, it } from "vitest";
import { useThemeStore } from "@/store/themeStore";
import { useUserStore } from "@/store/userStore";

describe("stores", () => {
  it("toggles theme", () => {
    useThemeStore.setState({ theme: "light" });
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("sets and clears user state", () => {
    useUserStore.getState().setUser("u-1", "reader@example.com");
    expect(useUserStore.getState().userId).toBe("u-1");
    expect(useUserStore.getState().email).toBe("reader@example.com");

    useUserStore.getState().clearUser();
    expect(useUserStore.getState().userId).toBeNull();
    expect(useUserStore.getState().email).toBeNull();
  });
});
