import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RegisterPage from "@/app/register/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

vi.mock("@/features/auth/RegisterForm", () => ({
  RegisterForm: () => <div>Register Form</div>,
}));

vi.mock("@/features/auth/LoginForm", () => ({
  LoginForm: () => <div>Login Form</div>,
}));

describe("RegisterPage", () => {
  it("switches between register and login modes", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText("Register Form")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Login" }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });
});
