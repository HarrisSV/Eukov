import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/LoginForm";

const pushMock = vi.fn();
const loginMock = vi.fn();
const getPreferencesMock = vi.fn();
const setSessionMock = vi.fn();
const setUserMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (state: { setSession: typeof setSessionMock }) => unknown) =>
    selector({ setSession: setSessionMock }),
}));

vi.mock("@/store/userStore", () => ({
  useUserStore: (selector: (state: { setUser: typeof setUserMock }) => unknown) =>
    selector({ setUser: setUserMock }),
}));

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      login: (...args: unknown[]) => loginMock(...args),
      getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
    },
  };
});

describe("LoginForm", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pushMock.mockReset();
    loginMock.mockReset();
    getPreferencesMock.mockReset();
    setSessionMock.mockReset();
    setUserMock.mockReset();
    localStorage.clear();
  });

  it("logs in and redirects to dashboard for users with preferences", async () => {
    const user = {
      id: "user-123",
      email: "reader@example.com",
      role: "READER",
    };
    loginMock.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      user,
    });
    getPreferencesMock.mockResolvedValue({ genres: ["history"] });

    const userEventApi = userEvent.setup();
    render(<LoginForm />);

    await userEventApi.type(screen.getByLabelText("Email"), "reader@example.com");
    await userEventApi.type(screen.getByLabelText("Password"), "password123");
    await userEventApi.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("reader@example.com", "password123");
      expect(setSessionMock).toHaveBeenCalledWith("access-token", "refresh-token", user);
      expect(setUserMock).toHaveBeenCalledWith("user-123", "reader@example.com");
      expect(getPreferencesMock).toHaveBeenCalledWith("user-123");
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
