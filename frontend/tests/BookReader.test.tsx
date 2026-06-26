import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BookReader } from "@/features/reader/BookReader";

const getDocumentPage = vi.fn();

vi.mock("@/features/reader/StPageFlipBook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/reader/StPageFlipBook")>();

  const MockStPageFlipBook = forwardRef(function MockStPageFlipBook(
    {
      pages,
      onFlip,
      startPageIndex,
    }: {
      pages: Array<{ pageNumber: number; content: string }>;
      onFlip?: (pageIndex: number) => void;
      startPageIndex: number;
    },
    ref,
  ) {
    const [pageIndex, setPageIndex] = useState(startPageIndex);

    useImperativeHandle(ref, () => ({
      flipNext() {
        const next = Math.min(pages.length - 1, pageIndex + 2);
        setPageIndex(next);
        onFlip?.(next);
      },
      flipPrev() {
        const next = Math.max(0, pageIndex - 2);
        setPageIndex(next);
        onFlip?.(next);
      },
      turnToPage(index: number) {
        setPageIndex(index);
      },
      flipToPage(index: number) {
        setPageIndex(index);
        onFlip?.(index);
      },
      getCurrentPageIndex() {
        return pageIndex;
      },
      remeasure() {},
    }));

    const left = pages[pageIndex];
    const right = pages[pageIndex + 1];

    return (
      <div>
        {left ? <div data-flipbook-page={left.pageNumber}>{left.content}</div> : null}
        {right ? <div data-flipbook-page={right.pageNumber}>{right.content}</div> : null}
      </div>
    );
  });

  return {
    ...actual,
    StPageFlipBook: MockStPageFlipBook,
  };
});

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
    getDocumentPage.mockImplementation(async (_id: string, page: number) => ({
      page: {
        documentId: "d1",
        title: "Sample",
        page,
        totalPages: 3,
        content:
          page === 1
            ? "Page one text"
            : page === 2
              ? "Page two text"
              : "Page three text",
      },
    }));
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        cancel: vi.fn(),
        speak: vi.fn(),
        getVoices: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders spread labels and navigates between spreads", async () => {
    const user = userEvent.setup();
    renderWithClient(<BookReader documentId="d1" />);

    expect(await screen.findByText("Sample")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bookmark" })).toBeInTheDocument();
    expect(screen.getByText("Pages 1–2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Jump to pages 1-2")).toHaveValue("1");
    expect(screen.getByText("Page one text")).toBeInTheDocument();
    expect(screen.getByText("Page two text")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Pages 3 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Jump to pages 3")).toHaveValue("3");
    expect(screen.getByText("Page three text")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Pages 1–2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Jump to pages 1-2")).toHaveValue("1");
  });
});
