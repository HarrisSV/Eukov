import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "@/features/auth/RegisterForm";

const pushMock = vi.fn();
const registerMock = vi.fn();

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
  },
}));

describe("RegisterForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pushMock.mockReset();
    registerMock.mockReset();
    localStorage.clear();
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("submits valid data and redirects", async () => {
    registerMock.mockResolvedValue({ success: true, userId: "user-123" });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "reader@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("reader@example.com", "password123");
      expect(pushMock).toHaveBeenCalledWith("/onboarding/genres");
    });
  });
});
