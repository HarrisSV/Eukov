import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookReader } from "@/features/reader/BookReader";

const getDocumentPage = vi.fn();

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getDocumentPage: (...args: unknown[]) => getDocumentPage(...args),
      getDocumentPreview: vi.fn().mockResolvedValue({
        preview: { authorId: "a1", authorEmail: "a@test.com", hasAccess: true },
      }),
      saveProgress: vi.fn().mockResolvedValue({ progress: {} }),
      subscribeAuthor: vi.fn(),
    },
  };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("BookReader", () => {
  beforeEach(() => {
    getDocumentPage.mockResolvedValue({
      page: {
        documentId: "d1",
        title: "Sample",
        page: 1,
        totalPages: 2,
        content: "Hello reader",
      },
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] },
      writable: true,
    });
  });

  it("renders paginated content", async () => {
    renderWithClient(<BookReader documentId="d1" />);
    expect(await screen.findByText("Sample")).toBeInTheDocument();
    expect(screen.getByText("Hello reader")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
});
