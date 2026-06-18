import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenreQuestionnaire } from "@/features/onboarding/GenreQuestionnaire";
import { useUserStore } from "@/store/userStore";

const pushMock = vi.fn();
const getGenresMock = vi.fn();
const savePreferencesMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/services/api", async () => {
  const actual = await vi.importActual<typeof import("@/services/api")>("@/services/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      getGenres: (...args: unknown[]) => getGenresMock(...args),
      savePreferences: (...args: unknown[]) => savePreferencesMock(...args),
    },
  };
});

describe("GenreQuestionnaire", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pushMock.mockReset();
    getGenresMock.mockReset();
    savePreferencesMock.mockReset();
    useUserStore.setState({ userId: "user-123", email: "reader@example.com" });
    getGenresMock.mockResolvedValue({
      genres: [
        { id: "1", name: "history" },
        { id: "2", name: "science" },
      ],
    });
  });

  it("requires at least one selection", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <GenreQuestionnaire />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "Continue to Dashboard" }));
    expect(screen.getByText("Select at least one genre.")).toBeInTheDocument();
  });

  it("saves selected genres and navigates to dashboard", async () => {
    savePreferencesMock.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <GenreQuestionnaire />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("button", { name: "History" }));
    await user.click(await screen.findByRole("button", { name: "Science" }));
    await user.click(screen.getByRole("button", { name: "Continue to Dashboard" }));

    await waitFor(() => {
      expect(savePreferencesMock).toHaveBeenCalledWith(["history", "science"]);
      expect(pushMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});
