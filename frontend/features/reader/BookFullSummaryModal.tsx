"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { LoadingBuffer } from "@/components/ui/LoadingBuffer";
import { QwenAILogo } from "@/components/ui/QwenAILogo";
import { api } from "@/services/api";

interface BookFullSummaryModalProps {
  documentId: string;
  title: string;
  onClose: () => void;
}

export function BookFullSummaryModal({
  documentId,
  title,
  onClose,
}: BookFullSummaryModalProps) {
  const [mounted, setMounted] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["book-ai-full-summary", documentId],
    queryFn: async () => (await api.getDocumentAIFullSummary(documentId)).summary,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
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

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="reader-full-summary-page" role="dialog" aria-modal="true" aria-labelledby="reader-full-summary-title">
      <header className="reader-full-summary-page__header">
        <button
          type="button"
          onClick={onClose}
          className="reader-full-summary-page__back"
          aria-label="Back to reading view"
        >
          ← Back
        </button>
        <div className="reader-full-summary-page__heading">
          <p className="reader-full-summary-page__eyebrow">AI Summary</p>
          <h1 id="reader-full-summary-title" className="reader-full-summary-page__title">
            {title}
          </h1>
          {summaryQuery.data ? (
            <p className="reader-full-summary-page__meta">
              Scanned {summaryQuery.data.wordCount?.toLocaleString() ?? "—"} words
              {typeof summaryQuery.data.imageCount === "number"
                ? ` · ${summaryQuery.data.imageCount} images/figures`
                : ""}
            </p>
          ) : null}
        </div>
      </header>

      <div className="reader-full-summary-page__body">
        {summaryQuery.isLoading ? (
          <div className="reader-full-summary-page__loading">
            <QwenAILogo className="reader-full-summary-page__logo" />
            <LoadingBuffer
              title="Scanning the entire book…"
              detail="Qwen AI is reading every word and figure to build your full summary."
              className="reader-full-summary-page__buffer"
            />
          </div>
        ) : null}

        {summaryQuery.isError ? (
          <p className="reader-full-summary-page__error" role="alert">
            Could not generate the full summary right now. Try again in a moment.
          </p>
        ) : null}

        {summaryQuery.data ? (
          <article className="reader-full-summary-page__content">
            {summaryQuery.data.summary.split("\n\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </article>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
