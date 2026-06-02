import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach } from "vitest";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useThemeStore } from "@/store/themeStore";

describe("ThemeToggle", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "light" });
  });

  it("toggles theme label", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: /dark theme/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button", { name: /light theme/i })).toBeInTheDocument();
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});
