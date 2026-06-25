import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LibraryCatalog } from "@/features/library/LibraryCatalog";

vi.mock("@/services/api", () => ({
  api: {
    getGenres: vi.fn().mockResolvedValue({ genres: [{ id: "g1", name: "history" }] }),
    getLibrary: vi.fn().mockResolvedValue({
      books: [
        {
          id: "d1",
          title: "Test Book",
          authorId: "a1",
          authorEmail: "author@test.com",
          authorName: "Jane Austen",
          genreName: "history",
          tags: ["war"],
          openCount: 0,
        },
      ],
    }),
    getRecommendedLibrary: vi.fn().mockResolvedValue({ books: [] }),
    getDocketBooks: vi.fn().mockResolvedValue({ books: [] }),
    getDocumentPreview: vi.fn(),
  },
  formatGenreLabel: (name: string) => name.charAt(0).toUpperCase() + name.slice(1),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("LibraryCatalog", () => {
  it("renders catalog books", async () => {
    renderWithClient(<LibraryCatalog />);
    expect(await screen.findByText("Test Book")).toBeInTheDocument();
    expect(screen.getByText("by Jane Austen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /preview/i })).toBeInTheDocument();
  });
});
