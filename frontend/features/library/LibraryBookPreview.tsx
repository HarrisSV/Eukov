"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type LibraryBook } from "@/services/api";
import { QwenAIWorkingOverlay } from "@/components/ui/QwenAIWorkingOverlay";
import { LibraryBookCover } from "@/features/library/LibraryBookCover";
import { resolveReadingResumePage } from "@/lib/reading-bookmark";

interface LibraryBookPreviewProps {
  book: LibraryBook;
  onClose: () => void;
}

export function LibraryBookPreview({ book, onClose }: LibraryBookPreviewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showSummary, setShowSummary] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const previewQuery = useQuery({
    queryKey: ["book-preview", book.id],
    queryFn: async () => (await api.getDocumentPreview(book.id)).preview,
  });

  const summaryQuery = useQuery({
    queryKey: ["book-ai-summary", book.id],
    queryFn: async () => (await api.getDocumentAISummary(book.id)).summary,
    enabled: showSummary,
  });

  const resumePage = useMemo(
    () => resolveReadingResumePage(book.id, null, 1),
    [book.id],
  );
  const continueReadingHref = `/dashboard/read/${book.id}?from=library&page=${resumePage}`;

  const subscribeMutation = useMutation({
    mutationFn: () => api.subscribeAuthor(book.authorId, book.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docket-books"] });
      queryClient.invalidateQueries({ queryKey: ["book-preview", book.id] });
      router.push(continueReadingHref);
    },
  });

  const preview = previewQuery.data;

  if (!mounted) {
    return null;
  }

  return createPortal(
    <>
      <QwenAIWorkingOverlay
        open={showSummary && summaryQuery.isPending}
        title="Generating quick summary…"
        detail="Qwen is reading the book to craft a concise summary for you."
      />
      <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      onClick={onClose}
    >
      <div
        className="portal-card flex max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-border/70 bg-background p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md border border-border/70 bg-surface">
              <LibraryBookCover
                coverUrl={book.coverUrl}
                tags={book.tags}
                title={book.title}
                authorName={book.authorName}
                genreName={book.genreName}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 id="preview-title" className="text-2xl font-bold text-foreground">
                {book.title}
              </h2>
              {book.authorName ? (
                <p className="text-sm text-muted">-by {book.authorName}</p>
              ) : null}
            </div>
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

            {showSummary && (
              <section
                className="border-2 border-foreground bg-surface p-4"
                aria-label="Quick summary"
              >
                <h3 className="text-sm font-bold uppercase tracking-wide">Quick summary</h3>
                {summaryQuery.isError && (
                  <p className="mt-2 text-sm text-danger" role="alert">
                    Could not generate summary right now.
                  </p>
                )}
                {summaryQuery.data && (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {summaryQuery.data.summary}
                  </p>
                )}
                {!summaryQuery.data?.usedAi && summaryQuery.isSuccess && (
                  <p className="mt-2 text-xs text-muted">
                    Set HUGGINGFACE_API_TOKEN to enable Qwen-powered summaries.
                  </p>
                )}
              </section>
            )}

            <div className="flex flex-wrap gap-2">
              {preview.hasAccess ? (
                <Link
                  href={continueReadingHref}
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
                    : `Subscribe to ${book.authorName ?? "author"} to read more`}
                </button>
              ) : (
                <Link
                  href={continueReadingHref}
                  className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Read full book
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowSummary((value) => !value)}
                className="border-2 border-foreground px-4 py-2 text-sm font-medium text-foreground"
              >
                {showSummary ? "Hide quick summary" : "Quick summary"}
              </button>
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
    </>,
    document.body,
  );
}
