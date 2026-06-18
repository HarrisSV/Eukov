import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";

const pushMock = vi.fn();
const registerMock = vi.fn();
const loginMock = vi.fn();

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
    register: (...args: unknown[]) => registerMock(...args),
    login: (...args: unknown[]) => loginMock(...args),
  },
}));

describe("RegisterForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pushMock.mockReset();
    registerMock.mockReset();
    loginMock.mockReset();
    localStorage.clear();
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Nickname is required")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("submits valid data and redirects", async () => {
    registerMock.mockResolvedValue({ success: true, userId: "user-123" });
    loginMock.mockResolvedValue({
      accessToken: "token",
      refreshToken: "refresh",
      user: {
        id: "user-123",
        email: "reader@example.com",
        role: "READER",
        firstName: "Reader",
        lastName: "Example",
        nickname: "reader",
      },
    });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("First name"), "Reader");
    await user.type(screen.getByLabelText("Last name"), "Example");
    await user.type(screen.getByLabelText("Nickname"), "reader");
    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        email: "reader@example.com",
        password: "password123",
        firstName: "Reader",
        lastName: "Example",
        nickname: "reader",
      });
      expect(pushMock).toHaveBeenCalledWith("/onboarding/genres");
    });
  });
});
