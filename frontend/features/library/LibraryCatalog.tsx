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

export function LibraryCatalog() {
  const [query, setQuery] = useState("");
  const [genreId, setGenreId] = useState("");
  const [sort, setSort] = useState<LibraryQueryParams["sort"]>("newest");
  const [search, setSearch] = useState("");
  const [previewBook, setPreviewBook] = useState<LibraryBook | null>(null);

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: async () => (await api.getGenres()).genres,
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
    queryFn: async () => (await api.getRecommendedLibrary()).books,
  });

  const books = libraryQuery.data?.books ?? [];

  const genreOptions = useMemo(
    () => genresQuery.data ?? [],
    [genresQuery.data],
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Discover</h2>
        <p className="text-sm text-muted">
          Preview the first 250 words free. Subscribe to an author to read the full book — it saves to your docket automatically.
        </p>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
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
            className="border-2 border-foreground bg-surface px-3 py-2 text-foreground md:col-span-2"
            aria-label="Search library"
          />
          <select
            value={genreId}
            onChange={(e) => setGenreId(e.target.value)}
            className="border-2 border-foreground bg-surface px-3 py-2 text-foreground"
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
            onChange={(e) =>
              setSort(e.target.value as LibraryQueryParams["sort"])
            }
            className="border-2 border-foreground bg-surface px-3 py-2 text-foreground"
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

      {recommendedQuery.data && recommendedQuery.data.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-foreground">Recommended for you</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendedQuery.data.map((book) => (
              <LibraryCard
                key={`rec-${book.id}`}
                book={book}
                onPreview={() => setPreviewBook(book)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Catalog</h2>
        {libraryQuery.isLoading && (
          <p className="text-sm text-muted">Loading library...</p>
        )}
        {libraryQuery.isError && (
          <p className="text-sm text-danger" role="alert">
            Could not load the library catalog. Restart the backend after applying Phase 4 migrations (000017–000020).
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  onPreview,
}: {
  book: LibraryBook;
  onPreview: () => void;
}) {
  return (
    <article className="wireframe-panel flex flex-col gap-3 border-2 border-foreground bg-background p-4">
      <h3 className="font-bold text-foreground">{book.title}</h3>
      <p className="text-sm text-muted">{book.authorEmail}</p>
      {book.genreName && (
        <p className="text-sm text-muted">{formatGenreLabel(book.genreName)}</p>
      )}
      {book.summary && (
        <p className="line-clamp-3 text-sm text-foreground">{book.summary}</p>
      )}
      {book.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {book.tags.map((tag) => (
            <li
              key={tag}
              className="border border-foreground px-2 py-0.5 text-xs uppercase"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto">
        <button
          type="button"
          onClick={onPreview}
          className="w-full border-2 border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background"
        >
          Preview · Read more
        </button>
      </div>
    </article>
  );
}
