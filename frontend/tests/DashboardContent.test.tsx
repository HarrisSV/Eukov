import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardContent } from "@/features/dashboard/DashboardContent";
import { useUserStore } from "@/store/userStore";

const healthMock = vi.fn();
const getPreferencesMock = vi.fn();

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      health: (...args: unknown[]) => healthMock(...args),
      getPreferences: (...args: unknown[]) => getPreferencesMock(...args),
    },
  };
});

describe("DashboardContent", () => {
  beforeEach(() => {
    healthMock.mockReset();
    getPreferencesMock.mockReset();
    useUserStore.setState({
      userId: "user-123",
      email: "reader@example.com",
    });
  });

  it("renders persisted preferences and healthy state", async () => {
    healthMock.mockResolvedValue({ status: "healthy" });
    getPreferencesMock.mockResolvedValue({ genres: ["history", "science"] });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DashboardContent />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Reader Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Welcome back, reader@example.com")).toBeInTheDocument();
      expect(screen.getByText("History")).toBeInTheDocument();
      expect(screen.getByText("Science")).toBeInTheDocument();
      expect(screen.getByText("Healthy")).toBeInTheDocument();
    });
  });
});
