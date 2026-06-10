"use client";

import { useQuery } from "@tanstack/react-query";
import { api, formatGenreLabel } from "@/services/api";

export function LibraryCatalog() {
  const libraryQuery = useQuery({
    queryKey: ["library-documents"],
    queryFn: api.listLibraryDocuments,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Published works across the platform catalog.</p>
      {libraryQuery.isLoading && (
        <p className="text-sm text-muted">Loading library...</p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {libraryQuery.data?.documents.map((doc) => (
          <article
            key={doc.id}
            className="wireframe-panel border-2 border-foreground bg-background p-4"
          >
            <h2 className="font-bold text-foreground">{doc.title}</h2>
            {doc.genreName && (
              <p className="mt-1 text-sm text-muted">
                {formatGenreLabel(doc.genreName)}
              </p>
            )}
            {doc.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {doc.tags.map((tag) => (
                  <li
                    key={tag}
                    className="border border-foreground px-2 py-0.5 text-xs uppercase"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
      {!libraryQuery.isLoading &&
        libraryQuery.data?.documents.length === 0 && (
          <p className="text-sm text-muted">No published documents yet.</p>
        )}
    </div>
  );
}
