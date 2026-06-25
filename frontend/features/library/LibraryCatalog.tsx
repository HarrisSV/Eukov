"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  api,
  formatGenreLabel,
  type LibraryBook,
  type LibraryQueryParams,
} from "@/services/api";
import { LibraryBookPreview } from "@/features/library/LibraryBookPreview";

const SORT_OPTIONS: { value: LibraryQueryParams["sort"]; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "most_read", label: "Most read" },
  { value: "recently_published", label: "Recently published" },
];

const RECOMMENDED_LIMIT = 8;

export function LibraryCatalog() {
  const [query, setQuery] = useState("");
  const [genreId, setGenreId] = useState("");
  const [sort, setSort] = useState<LibraryQueryParams["sort"]>("newest");
  const [search, setSearch] = useState("");
  const [previewBook, setPreviewBook] = useState<LibraryBook | null>(null);

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: api.getGenres,
  });

  const libraryQuery = useQuery({
    queryKey: ["library", search, genreId, sort],
    queryFn: () =>
      api.getLibrary({
        q: search || undefined,
        genreId: genreId || undefined,
        sort,
      }),
  });

  const recommendedQuery = useQuery({
    queryKey: ["library-recommended"],
    queryFn: async () =>
      (await api.getRecommendedLibrary(RECOMMENDED_LIMIT)).books,
  });

  const docketQuery = useQuery({
    queryKey: ["docket-books"],
    queryFn: async () => (await api.getDocketBooks()).books,
  });

  const books = libraryQuery.data?.books ?? [];

  const continueReadingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of docketQuery.data ?? []) {
      if (entry.lastOpenedAt || entry.currentPage > 1) {
        ids.add(entry.documentId);
      }
    }
    return ids;
  }, [docketQuery.data]);

  const recommendedBooks = useMemo(
    () => (recommendedQuery.data ?? []).slice(0, RECOMMENDED_LIMIT),
    [recommendedQuery.data],
  );

  const genreOptions = useMemo(
    () => genresQuery.data?.genres ?? [],
    [genresQuery.data],
  );

  return (
    <div className="flex flex-col gap-10">
      <section className="portal-card rounded-2xl border border-border/70 bg-background p-5 md:p-6">
        <h2 className="font-serif text-xl font-semibold text-foreground">Discover</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Preview the first 250 words free. Subscribe to an author to read the full book — it saves to your docket automatically.
        </p>
        <form
          className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, author, genre..."
            className="portal-input px-4 py-2.5 text-sm md:col-span-2"
            aria-label="Search library"
          />
          <select
            value={genreId}
            onChange={(e) => setGenreId(e.target.value)}
            className="portal-input px-4 py-2.5 text-sm"
            aria-label="Filter by genre"
          >
            <option value="">All genres</option>
            {genreOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {formatGenreLabel(g.name)}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as LibraryQueryParams["sort"])}
            className="portal-input px-4 py-2.5 text-sm"
            aria-label="Sort library"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </form>
      </section>

      {recommendedBooks.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-xl font-semibold text-foreground">Recommended for you</h2>
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-accent-warm">
              Curated picks
            </span>
          </div>
          <div
            className="-mx-1 overflow-x-auto px-1 pb-2"
            role="region"
            aria-label="Recommended books"
          >
            <div className="flex gap-3">
              {recommendedBooks.map((book) => (
                <div key={`rec-${book.id}`} className="w-40 shrink-0 sm:w-44">
                  <LibraryCard
                    book={book}
                    continueReading={continueReadingIds.has(book.id)}
                    onPreview={() => setPreviewBook(book)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="flex min-h-0 flex-col gap-4">
        <h2 className="font-serif text-xl font-semibold text-foreground">Catalog</h2>
        {libraryQuery.isLoading && (
          <p className="text-sm text-muted">Loading library...</p>
        )}
        {libraryQuery.isError && (
          <p className="text-sm text-danger" role="alert">
            Could not load the library catalog. Restart the backend after applying Phase 4 migrations (000017–000020).
          </p>
        )}
        <div className="max-h-[calc(100vh-22rem)] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {books.map((book) => (
              <LibraryCard
                key={book.id}
                book={book}
                onPreview={() => setPreviewBook(book)}
              />
            ))}
          </div>
          {!libraryQuery.isLoading && !libraryQuery.isError && books.length === 0 && (
            <p className="text-sm text-muted">
              No published books match your filters. Try clearing the genre filter.
            </p>
          )}
        </div>
      </section>

      {previewBook && (
        <LibraryBookPreview
          book={previewBook}
          onClose={() => setPreviewBook(null)}
        />
      )}
    </div>
  );
}

function LibraryCard({
  book,
  continueReading = false,
  onPreview,
}: {
  book: LibraryBook & { reason?: string };
  continueReading?: boolean;
  onPreview: () => void;
}) {
  return (
    <article className="group portal-card flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-background transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-warm/30">
      {book.coverUrl ? (
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={book.coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center bg-surface">
          <span className="font-serif text-2xl text-muted/40">E</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <h3 className="line-clamp-2 font-serif text-sm font-semibold leading-snug text-foreground">
          {book.title}
        </h3>
        {book.authorName ? (
          <p className="truncate text-xs text-muted">by {book.authorName}</p>
        ) : null}
        {book.genreName && (
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-accent-warm">
            {formatGenreLabel(book.genreName)}
          </p>
        )}
        {book.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted">{book.summary}</p>
        )}
        {"reason" in book && book.reason ? (
          <p className="rounded-md bg-accent-soft px-2 py-1 text-[10px] leading-snug text-accent-warm">
            AI pick · {book.reason}
          </p>
        ) : null}
        {book.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1">
            {book.tags.slice(0, 2).map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border/80 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-1 pt-1">
          <button
            type="button"
            onClick={onPreview}
            className="portal-btn-primary w-full px-2 py-1.5 text-xs"
          >
            Preview
          </button>
          {continueReading ? (
            <p className="text-center text-[10px] font-medium uppercase tracking-[0.1em] text-accent-warm">
              Continue reading
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
