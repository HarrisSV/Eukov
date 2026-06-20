"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/services/api";
import {
  formatSpreadLabel,
  htmlToPlainText,
  isHtmlContent,
  leftPageForTarget,
  nextSpreadLeft,
  prevSpreadLeft,
  rightPageNumber,
  spreadEndPage,
  spreadLeftPages,
} from "@/features/reader/page-content";
import {
  StPageFlipBook,
  type StPageFlipBookHandle,
} from "@/features/reader/StPageFlipBook";
import {
  pageNumberFromSelection,
  readReadingBookmark,
  selectionOffsetIn,
  writeReadingBookmark,
  type ReadingBookmark,
} from "@/lib/reading-bookmark";
import { scrollToReadingPosition } from "@/lib/reading-bookmark-scroll";
import "./book-reader.css";

interface BookReaderProps {
  documentId: string;
  initialPage?: number;
}

export function BookReader({ documentId, initialPage = 1 }: BookReaderProps) {
  const queryClient = useQueryClient();
  const spreadHydratedRef = useRef(false);
  const pendingScrollRef = useRef<{ page: number; charOffset?: number } | null>(null);
  const leftTextRef = useRef<HTMLDivElement | null>(null);
  const rightTextRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<StPageFlipBookHandle | null>(null);
  const [leftPage, setLeftPage] = useState(() => Math.max(1, initialPage));
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [bookmark, setBookmark] = useState<ReadingBookmark | null>(null);
  const [checkpointMessage, setCheckpointMessage] = useState<string | null>(null);
  const [navLocked, setNavLocked] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const metaQuery = useQuery({
    queryKey: ["document-page", documentId, 1],
    queryFn: async () => (await api.getDocumentPage(documentId, 1)).page,
    enabled: Boolean(documentId),
  });

  const totalPages = metaQuery.data?.totalPages ?? 1;

  const pageQueries = useQueries({
    queries: Array.from({ length: totalPages }, (_, index) => ({
      queryKey: ["document-page", documentId, index + 1],
      queryFn: async () => (await api.getDocumentPage(documentId, index + 1)).page,
      enabled: Boolean(documentId) && metaQuery.isSuccess,
    })),
  });

  const pagesReady = pageQueries.length > 0 && pageQueries.every((query) => query.isSuccess);
  const pages = pagesReady
    ? pageQueries.map((query) => ({
        pageNumber: query.data!.page,
        content: query.data!.content,
      }))
    : [];

  const previewQuery = useQuery({
    queryKey: ["book-preview", documentId],
    queryFn: async () => (await api.getDocumentPreview(documentId)).preview,
    enabled: Boolean(documentId),
  });

  const progressMutation = useMutation({
    mutationFn: (p: number) => api.saveProgress(documentId, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["docket-books"] });
    },
  });

  const subscribeMutation = useMutation({
    mutationFn: () => {
      const authorId = previewQuery.data?.authorId;
      if (!authorId) throw new Error("Author not found");
      return api.subscribeAuthor(authorId, documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-page", documentId] });
      queryClient.invalidateQueries({ queryKey: ["docket-books"] });
      metaQuery.refetch();
    },
  });

  const accessDenied =
    metaQuery.error instanceof ApiError && metaQuery.error.status === 403;

  const rightPage = rightPageNumber(leftPage, totalPages);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    utteranceRef.current = null;
  }, []);

  const syncTextRefs = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    leftTextRef.current = document.querySelector(
      `[data-flipbook-page="${leftPage}"] .reader-page__text`,
    ) as HTMLDivElement | null;

    rightTextRef.current = rightPage
      ? (document.querySelector(
          `[data-flipbook-page="${rightPage}"] .reader-page__text`,
        ) as HTMLDivElement | null)
      : null;
  }, [leftPage, rightPage]);

  const changeSpread = useCallback(
    (next: number | ((current: number) => number), options?: { animate?: boolean }) => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
      setPlaying(false);

      const targetLeft = typeof next === "function" ? next(leftPage) : next;
      if (targetLeft === leftPage) {
        return;
      }

      const targetIndex = targetLeft - 1;
      const reducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const shouldAnimate = options?.animate === true && !reducedMotion && bookRef.current;

      if (!shouldAnimate) {
        bookRef.current?.turnToPage(targetIndex);
        setLeftPage(targetLeft);
        return;
      }

      setNavLocked(true);
      bookRef.current?.flipToPage(targetIndex);
    },
    [leftPage],
  );

  const handleBookFlip = useCallback(
    (pageIndex: number) => {
      const nextLeft = pageIndex + 1;
      setLeftPage(nextLeft);
      setNavLocked(false);
      progressMutation.mutate(nextLeft);
      window.requestAnimationFrame(syncTextRefs);
    },
    [progressMutation, syncTextRefs],
  );

  const speakSpread = useCallback(() => {
    const leftContent = pages.find((page) => page.pageNumber === leftPage)?.content ?? "";
    const rightContent = rightPage
      ? (pages.find((page) => page.pageNumber === rightPage)?.content ?? "")
      : "";
    const text = [htmlToPlainText(leftContent), htmlToPlainText(rightContent)]
      .filter(Boolean)
      .join("\n\n");
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.onend = () => setPlaying(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [leftPage, pages, rate, rightPage, stopSpeech]);

  useEffect(() => {
    spreadHydratedRef.current = false;
    setBookmark(readReadingBookmark(documentId));
    setCheckpointMessage(null);
  }, [documentId]);

  useEffect(() => {
    if (!checkpointMessage) {
      return;
    }
    const timer = window.setTimeout(() => setCheckpointMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [checkpointMessage]);

  const applyPendingScroll = useCallback(() => {
    const pending = pendingScrollRef.current;
    if (!pending) {
      return;
    }

    syncTextRefs();
    const container =
      pending.page === leftPage
        ? leftTextRef.current
        : pending.page === rightPage
          ? rightTextRef.current
          : null;

    if (!container) {
      return;
    }

    pendingScrollRef.current = null;
    window.requestAnimationFrame(() => {
      scrollToReadingPosition(container, pending.charOffset);
    });
  }, [leftPage, rightPage, syncTextRefs]);

  useEffect(() => {
    if (!pagesReady || spreadHydratedRef.current) {
      return;
    }
    spreadHydratedRef.current = true;
    const spreadLeft = leftPageForTarget(initialPage, totalPages);
    setLeftPage(spreadLeft);
    bookRef.current?.turnToPage(spreadLeft - 1);
  }, [initialPage, pagesReady, totalPages]);

  useEffect(() => {
    if (!pagesReady) {
      return;
    }
    syncTextRefs();
    applyPendingScroll();
  }, [applyPendingScroll, leftPage, pagesReady, syncTextRefs]);

  const handleBookmark = useCallback(() => {
    syncTextRefs();
    const selectedPage = pageNumberFromSelection(leftPage);
    const container =
      selectedPage === leftPage
        ? leftTextRef.current
        : selectedPage === rightPage
          ? rightTextRef.current
          : leftTextRef.current;
    const selectionText =
      typeof window !== "undefined" ? window.getSelection()?.toString().trim() : "";
    const charOffset = container ? selectionOffsetIn(container) : undefined;

    const saved: ReadingBookmark = {
      documentId,
      page: selectedPage,
      anchorText: selectionText || undefined,
      charOffset,
      savedAt: Date.now(),
    };

    writeReadingBookmark(saved);
    setBookmark(saved);
    setCheckpointMessage(`Checkpoint made at page ${selectedPage}`);
    progressMutation.mutate(selectedPage);
  }, [documentId, leftPage, progressMutation, rightPage, syncTextRefs]);

  const handleResumeBookmark = useCallback(() => {
    if (!bookmark) {
      return;
    }
    pendingScrollRef.current = {
      page: bookmark.page,
      charOffset: bookmark.charOffset,
    };
    changeSpread(leftPageForTarget(bookmark.page, totalPages));
  }, [bookmark, changeSpread, totalPages]);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const title = metaQuery.data?.title ?? "Loading...";
  const spreadEnd = spreadEndPage(leftPage, totalPages);
  const spreadLabel = formatSpreadLabel(leftPage, totalPages);
  const spreadOptions = spreadLeftPages(totalPages);
  const canGoPrev = leftPage > 1 && !navLocked;
  const canGoNext = nextSpreadLeft(leftPage, totalPages) !== leftPage && !navLocked;
  const startPageIndex = leftPageForTarget(initialPage, totalPages) - 1;

  return (
    <div className="reader-shell min-h-0 flex-1">
      <header className="reader-header">
        <h1 className="reader-header__title">{title}</h1>
        <p className="reader-header__meta">
          Pages {leftPage}
          {spreadEnd !== leftPage ? `–${spreadEnd}` : ""} of {totalPages}
        </p>
      </header>

      {metaQuery.isLoading && <p className="text-sm text-muted">Loading pages...</p>}

      {accessDenied && previewQuery.data && (
        <div className="flex flex-col gap-4 border border-border bg-surface p-4">
          <p className="text-sm text-foreground">
            Subscribe to {previewQuery.data.authorEmail} to read the full book. The book will be
            saved to your docket automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate()}
              className="border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              {subscribeMutation.isPending ? "Subscribing..." : "Subscribe to read"}
            </button>
            <Link
              href="/dashboard/library"
              className="border border-foreground px-4 py-2 text-sm text-foreground"
            >
              Back to library
            </Link>
          </div>
        </div>
      )}

      {metaQuery.error && !accessDenied && (
        <p className="text-sm text-foreground" role="alert">
          Unable to load this page.
        </p>
      )}

      {metaQuery.data && (
        <div className="reader-main">
          <aside className="reader-toolbar">
            <nav className="reader-controls" aria-label="Reading controls">
              <div className="reader-bookmark">
                <button
                  type="button"
                  onClick={handleBookmark}
                  className="reader-controls__button reader-controls__button--bookmark"
                >
                  Bookmark
                </button>
                {checkpointMessage ? (
                  <p className="reader-bookmark__message" role="status">
                    {checkpointMessage}
                  </p>
                ) : null}
                {bookmark ? (
                  <button
                    type="button"
                    onClick={handleResumeBookmark}
                    className="reader-controls__button reader-controls__button--resume"
                  >
                    Read from where you left
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => changeSpread((p) => prevSpreadLeft(p), { animate: true })}
                className="reader-controls__button disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => changeSpread((p) => nextSpreadLeft(p, totalPages), { animate: true })}
                className="reader-controls__button disabled:cursor-not-allowed"
              >
                Next
              </button>
              <label className="reader-controls__field">
                Jump to
                <select
                  value={leftPage}
                  onChange={(e) => changeSpread(Number(e.target.value))}
                  className="reader-controls__select reader-controls__select--spread"
                  aria-label={`Jump to pages ${spreadLabel}`}
                >
                  {spreadOptions.map((spreadLeft) => (
                    <option key={spreadLeft} value={spreadLeft}>
                      {formatSpreadLabel(spreadLeft, totalPages)}
                    </option>
                  ))}
                </select>
              </label>
            </nav>

            <section className="reader-audio" aria-label="Audio reader">
              <span className="reader-audio__label">Audio reader</span>
              {!playing ? (
                <button type="button" onClick={speakSpread} className="reader-controls__button">
                  Play
                </button>
              ) : (
                <button type="button" onClick={stopSpeech} className="reader-controls__button">
                  Stop
                </button>
              )}
              <label className="reader-controls__field">
                Speed
                <select
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="reader-controls__select"
                  aria-label="Speech rate"
                >
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                </select>
              </label>
              {typeof window !== "undefined" && window.speechSynthesis && (
                <label className="reader-controls__field">
                  Voice
                  <select
                    className="reader-controls__select max-w-[12rem]"
                    aria-label="Voice selection"
                    onChange={(e) => {
                      const voices = window.speechSynthesis.getVoices();
                      const voice = voices.find((v) => v.name === e.target.value);
                      if (utteranceRef.current && voice) {
                        utteranceRef.current.voice = voice;
                      }
                    }}
                  >
                    {window.speechSynthesis.getVoices().map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          </aside>

          <div className="reader-stage-area">
            <div className="reader-stage w-full">
              <PageTurnButton
                direction="prev"
                disabled={!canGoPrev}
                onClick={() => changeSpread((p) => prevSpreadLeft(p), { animate: true })}
              />
              <div className="reader-book min-w-0">
                {!pagesReady ? (
                  <p className="reader-flipbook-loading">Preparing book...</p>
                ) : (
                  <StPageFlipBook
                    ref={bookRef}
                    pages={pages}
                    startPageIndex={startPageIndex}
                    onFlip={handleBookFlip}
                    onFlippingChange={setNavLocked}
                  />
                )}
              </div>
              <PageTurnButton
                direction="next"
                disabled={!canGoNext}
                onClick={() =>
                  changeSpread((p) => nextSpreadLeft(p, totalPages), { animate: true })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageTurnButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  const label = direction === "prev" ? "Previous page" : "Next page";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="reader-page-turn"
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}
