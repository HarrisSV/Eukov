import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardContent } from "@/features/dashboard/DashboardContent";
import { useAuthStore } from "@/store/authStore";

const getPreferencesMock = vi.fn();
const meMock = vi.fn();

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
      me: (...args: unknown[]) => meMock(...args),
    },
  };
});

describe("DashboardContent", () => {
  beforeEach(() => {
    getPreferencesMock.mockReset();
    meMock.mockReset();
    useAuthStore.setState({
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
    meMock.mockResolvedValue({
      id: "user-123",
      email: "reader@example.com",
      role: "READER",
      firstName: "Reader",
      lastName: "Example",
      nickname: "reader",
    });
  });

  it("renders persisted preferences and quick links", async () => {
    getPreferencesMock.mockResolvedValue({ genres: ["history", "science"] });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardContent />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "You" })).toBeInTheDocument();
      expect(screen.getByText(/Welcome back, reader/i)).toBeInTheDocument();
      expect(screen.getByText("Reader Example")).toBeInTheDocument();
      expect(screen.getByText("History")).toBeInTheDocument();
      expect(screen.getByText("Science")).toBeInTheDocument();
      expect(screen.getByText("Library")).toBeInTheDocument();
    });
  });
});
