"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type LibraryBook } from "@/services/api";

interface LibraryBookPreviewProps {
  book: LibraryBook;
  onClose: () => void;
}

export function LibraryBookPreview({ book, onClose }: LibraryBookPreviewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const previewQuery = useQuery({
    queryKey: ["book-preview", book.id],
    queryFn: async () => (await api.getDocumentPreview(book.id)).preview,
  });

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscribeAuthor(book.authorId, book.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docket-books"] });
      queryClient.invalidateQueries({ queryKey: ["book-preview", book.id] });
      router.push(`/dashboard/read/${book.id}?from=library`);
    },
  });

  const preview = previewQuery.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto border-2 border-foreground bg-background p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="preview-title" className="text-2xl font-bold text-foreground">
              {book.title}
            </h2>
            <p className="text-sm text-muted">{book.authorEmail}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-foreground px-2 py-1 text-sm"
            aria-label="Close preview"
          >
            Close
          </button>
        </div>

        {previewQuery.isLoading && (
          <p className="text-sm text-muted">Loading preview...</p>
        )}

        {preview && (
          <>
            <article className="border-2 border-border bg-surface p-4 text-foreground leading-relaxed">
              <p className="whitespace-pre-wrap">{preview.previewText}</p>
              {preview.requiresSubscription && !preview.hasAccess && (
                <p className="mt-4 text-sm text-muted">…</p>
              )}
            </article>

            <p className="text-xs text-muted">
              Showing {preview.wordCount} of {preview.totalWords} words
            </p>

            <div className="flex flex-wrap gap-2">
              {preview.hasAccess ? (
                <Link
                  href={`/dashboard/read/${book.id}?from=library`}
                  className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Continue reading
                </Link>
              ) : preview.requiresSubscription ? (
                <button
                  type="button"
                  disabled={subscribeMutation.isPending}
                  onClick={() => subscribeMutation.mutate()}
                  className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  {subscribeMutation.isPending
                    ? "Subscribing..."
                    : `Subscribe to ${book.authorEmail.split("@")[0]} to read more`}
                </button>
              ) : (
                <Link
                  href={`/dashboard/read/${book.id}?from=library`}
                  className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Read full book
                </Link>
              )}
              {preview.isSubscribed && !preview.hasAccess && (
                <button
                  type="button"
                  onClick={() => subscribeMutation.mutate()}
                  className="border-2 border-foreground px-4 py-2 text-sm text-foreground"
                >
                  Save to docket
                </button>
              )}
            </div>
            {subscribeMutation.isError && (
              <p className="text-sm text-danger" role="alert">
                Could not complete subscription. You may already be subscribed — try opening your docket.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
