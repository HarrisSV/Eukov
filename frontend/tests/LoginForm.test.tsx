import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/LoginForm";

const pushMock = vi.fn();
const loginMock = vi.fn();
const getPreferencesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/services/api", () => ({
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
  api: {
    login: (...args: unknown[]) => loginMock(...args),
    getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
  },
}));

describe("LoginForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pushMock.mockReset();
    loginMock.mockReset();
    getPreferencesMock.mockReset();
    localStorage.clear();
  });

  it("logs in and redirects to dashboard for users with preferences", async () => {
    loginMock.mockResolvedValue({
      success: true,
      userId: "user-123",
      email: "reader@example.com",
    });
    getPreferencesMock.mockResolvedValue({ genres: ["history"] });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("reader@example.com", "password123");
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
