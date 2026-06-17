"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError, formatGenreLabel, NetworkError } from "@/services/api";

interface PublishDialogProps {
  documentId: string;
  title: string;
  content: string;
  onClose: () => void;
  onPublished: () => void;
}

export function PublishDialog({
  documentId,
  title,
  content,
  onClose,
  onPublished,
}: PublishDialogProps) {
  const [genre, setGenre] = useState("");
  const [keywords, setKeywords] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const genresQuery = useQuery({
    queryKey: ["genres"],
    queryFn: api.getGenres,
  });

  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);
    const tags = keywords
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      await api.publishDocument(documentId, {
        genre,
        tags,
        title,
        content,
      });
      onPublished();
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Publish failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-title"
    >
      <div className="w-full max-w-lg border-2 border-foreground bg-background p-6">
        <h2 id="publish-title" className="text-lg font-bold uppercase">
          Publish manuscript
        </h2>
        <p className="mt-2 text-sm text-muted">
          Genre and at least one keyword required. Content must be 200+ characters.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="publish-genre">
            Genre
          </label>
          <select
            id="publish-genre"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="border-2 border-foreground bg-background px-3 py-2"
          >
            <option value="">Select genre</option>
            {(genresQuery.data?.genres ?? []).map((g) => (
              <option key={g.id} value={g.name}>
                {formatGenreLabel(g.name)}
              </option>
            ))}
          </select>

          <label className="text-sm font-medium" htmlFor="publish-keywords">
            Keywords (comma-separated)
          </label>
          <input
            id="publish-keywords"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="border-2 border-foreground bg-background px-3 py-2"
            placeholder="e.g. politics, essay"
          />
        </div>

        {error && (
          <p className="mt-3 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handlePublish}
            disabled={submitting || !genre}
            className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background disabled:opacity-50"
          >
            {submitting ? "Publishing..." : "Confirm publish"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-foreground px-4 py-2 text-sm uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
