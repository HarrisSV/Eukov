"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { api, ApiError } from "@/services/api";
import {
  formatViewLabel,
  leftPageForTarget,
  nextViewPage,
  prevViewPage,
  rightPageNumber,
  type ReaderSpreadMode,
  viewEndPage,
  viewPageOptions,
} from "@/features/reader/page-content";
import {
  buildSpeechScript,
  localCharIndex,
  nextSegment,
  pageForCharIndex,
  resumeCharIndexForNextWord,
  segmentForPage,
  wordRangeAt,
  type SpeechScript,
} from "@/features/reader/reader-speech";
import {
  clearAllTtsHighlights,
  highlightWordOnPage,
} from "@/features/reader/reader-speech-highlight";
import { BookSearchPanel } from "@/features/reader/BookSearchPanel";
import { ChapterNavStrip } from "@/features/reader/ChapterNavStrip";
import {
  activeChapterId as resolveActiveChapterId,
  annotateChapters,
  type BookChapter,
} from "@/features/reader/chapters";
import {
  StPageFlipBook,
  READER_ZOOM_DEFAULT,
  READER_ZOOM_MAX,
  READER_ZOOM_MIN,
  READER_ZOOM_STEP,
  clampReaderZoom,
  type StPageFlipBookHandle,
} from "@/features/reader/StPageFlipBook";
import {
  readReadingBookmark,
  resolveReadingResumePage,
  writeReadingBookmark,
  type ReadingBookmark,
} from "@/lib/reading-bookmark";
import { scrollToChapterMarker, scrollToReadingPosition } from "@/lib/reading-bookmark-scroll";
import { BookFullSummaryModal } from "@/features/reader/BookFullSummaryModal";
import "./book-reader.css";

const SPREAD_MODE_KEY = "eukov-reader-spread-mode";

function readSpreadModePreference(): ReaderSpreadMode {
  if (typeof window === "undefined") {
    return "double";
  }
  const stored = window.localStorage.getItem(SPREAD_MODE_KEY);
  return stored === "single" ? "single" : "double";
}

function writeSpreadModePreference(mode: ReaderSpreadMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SPREAD_MODE_KEY, mode);
}

interface BookReaderProps {
  documentId: string;
  initialPage?: number;
  from?: "library" | "docket";
}

export function BookReader({ documentId, initialPage = 1, from = "library" }: BookReaderProps) {
  const queryClient = useQueryClient();
  const spreadHydratedRef = useRef(false);
  const pendingScrollRef = useRef<{
    page: number;
    charOffset?: number;
    chapterId?: string;
  } | null>(null);
  const leftTextRef = useRef<HTMLDivElement | null>(null);
  const rightTextRef = useRef<HTMLDivElement | null>(null);
  const bookRef = useRef<StPageFlipBookHandle | null>(null);
  const [leftPage, setLeftPage] = useState(() => Math.max(1, initialPage));
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [bookmark, setBookmark] = useState<ReadingBookmark | null>(null);
  const [navLocked, setNavLocked] = useState(false);
  const [showFullSummary, setShowFullSummary] = useState(false);
  const [zoom, setZoom] = useState(READER_ZOOM_DEFAULT);
  const [spreadMode, setSpreadMode] = useState<ReaderSpreadMode>(() => readSpreadModePreference());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMounted, setFullscreenMounted] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const playingRef = useRef(false);
  const speechScriptRef = useRef<SpeechScript>({ text: "", segments: [] });
  const speechOffsetRef = useRef(0);
  const resumeCharIndexRef = useRef(0);
  const spreadModeRef = useRef(spreadMode);
  const totalPagesRef = useRef(1);
  const leftPageRef = useRef(leftPage);
  const rightPageRef = useRef<number | null>(null);

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

  const { chapters, pages: readerPages } = useMemo(
    () => annotateChapters(pages),
    [pages],
  );

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

  const rightPage = spreadMode === "double" ? rightPageNumber(leftPage, totalPages) : null;

  useEffect(() => {
    spreadModeRef.current = spreadMode;
  }, [spreadMode]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  useEffect(() => {
    leftPageRef.current = leftPage;
  }, [leftPage]);

  useEffect(() => {
    rightPageRef.current = rightPage;
  }, [rightPage]);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    cancelSpeech();
    setPlaying(false);
    clearAllTtsHighlights();
    speechScriptRef.current = { text: "", segments: [] };
    speechOffsetRef.current = 0;
    resumeCharIndexRef.current = 0;
  }, [cancelSpeech]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const available = synth.getVoices();
      if (available.length === 0) {
        return;
      }
      setVoices(available);
      setVoiceName((current) => {
        if (current && available.some((voice) => voice.name === current)) {
          return current;
        }
        const preferred =
          available.find((voice) => voice.lang.startsWith("en") && voice.default) ??
          available.find((voice) => voice.lang.startsWith("en")) ??
          available[0];
        return preferred?.name ?? "";
      });
    };
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const sortedVoices = useMemo(() => {
    return [...voices].sort((a, b) => {
      const aEnglish = a.lang.startsWith("en") ? 0 : 1;
      const bEnglish = b.lang.startsWith("en") ? 0 : 1;
      if (aEnglish !== bEnglish) {
        return aEnglish - bEnglish;
      }
      return a.name.localeCompare(b.name);
    });
  }, [voices]);

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
    (next: number | ((current: number) => number), options?: { animate?: boolean; keepSpeech?: boolean }) => {
      if (!options?.keepSpeech) {
        cancelSpeech();
        setPlaying(false);
        clearAllTtsHighlights();
        speechScriptRef.current = { text: "", segments: [] };
        speechOffsetRef.current = 0;
        resumeCharIndexRef.current = 0;
      }

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
    [cancelSpeech, leftPage],
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

  const turnToPageForSpeech = useCallback(
    (pageNumber: number) => {
      const targetLeft = leftPageForTarget(
        pageNumber,
        totalPagesRef.current,
        spreadModeRef.current,
      );
      if (targetLeft === leftPageRef.current) {
        return;
      }

      const targetIndex = targetLeft - 1;
      bookRef.current?.turnToPage(targetIndex);
      setLeftPage(targetLeft);
      leftPageRef.current = targetLeft;
      rightPageRef.current =
        spreadModeRef.current === "double"
          ? rightPageNumber(targetLeft, totalPagesRef.current)
          : null;
      progressMutation.mutate(targetLeft);
    },
    [progressMutation],
  );

  const highlightSpeechWord = useCallback(
    (globalCharIndex: number) => {
      const script = speechScriptRef.current;
      if (!script.text) {
        return;
      }

      resumeCharIndexRef.current = globalCharIndex;

      const pageNumber = pageForCharIndex(script.segments, globalCharIndex);
      const segment = segmentForPage(script.segments, pageNumber);
      if (!segment) {
        return;
      }

      const localStart = localCharIndex(segment, globalCharIndex);
      const { start, end } = wordRangeAt(segment.text, localStart);
      highlightWordOnPage(pageNumber, start, end);
    },
    [],
  );

  const speakFromGlobalIndex = useCallback(
    (fromCharIndex: number, options?: { rate?: number; voiceName?: string }) => {
      const script = speechScriptRef.current;
      if (!script.text || typeof window === "undefined" || !window.speechSynthesis) {
        return;
      }

      const globalStart = Math.min(Math.max(0, fromCharIndex), script.text.length);
      const pageNumber = pageForCharIndex(script.segments, globalStart);
      const segment = segmentForPage(script.segments, pageNumber);
      if (!segment) {
        stopSpeech();
        return;
      }

      speechOffsetRef.current = globalStart;
      resumeCharIndexRef.current = globalStart;

      const localStart = globalStart - segment.startChar;
      const pageSlice = segment.text.slice(localStart);
      if (!pageSlice.trim()) {
        const upcoming = nextSegment(script.segments, pageNumber);
        if (upcoming) {
          speakFromGlobalIndex(upcoming.startChar, options);
        } else {
          stopSpeech();
        }
        return;
      }

      turnToPageForSpeech(pageNumber);
      cancelSpeech();
      clearAllTtsHighlights();

      const speechRate = options?.rate ?? rate;
      const speechVoiceName = options?.voiceName ?? voiceName;
      const utterance = new SpeechSynthesisUtterance(pageSlice);
      utterance.rate = speechRate;

      const voice = voices.find((entry) => entry.name === speechVoiceName);
      if (voice) {
        utterance.voice = voice;
      }

      const segmentBase = segment.startChar + localStart;

      utterance.onboundary = (event) => {
        if (event.name === "word") {
          highlightSpeechWord(segmentBase + event.charIndex);
        }
      };

      utterance.onend = () => {
        clearAllTtsHighlights();
        const upcoming = nextSegment(script.segments, pageNumber);
        if (upcoming) {
          speakFromGlobalIndex(upcoming.startChar, { rate: speechRate, voiceName: speechVoiceName });
          return;
        }
        setPlaying(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setPlaying(true);
    },
    [
      cancelSpeech,
      highlightSpeechWord,
      rate,
      stopSpeech,
      turnToPageForSpeech,
      voiceName,
      voices,
    ],
  );

  const beginSpeech = useCallback(() => {
    speechScriptRef.current = buildSpeechScript(pages, leftPage);
    speakFromGlobalIndex(0);
  }, [leftPage, pages, speakFromGlobalIndex]);

  const handleRateChange = useCallback(
    (newRate: number) => {
      setRate(newRate);
      if (!playingRef.current) {
        return;
      }
      const resumeFrom = resumeCharIndexForNextWord(
        speechScriptRef.current.text,
        resumeCharIndexRef.current,
      );
      speakFromGlobalIndex(resumeFrom, { rate: newRate, voiceName });
    },
    [speakFromGlobalIndex, voiceName],
  );

  const handleVoiceChange = useCallback(
    (newVoiceName: string) => {
      setVoiceName(newVoiceName);
      if (!playingRef.current) {
        return;
      }
      const resumeFrom = resumeCharIndexForNextWord(
        speechScriptRef.current.text,
        resumeCharIndexRef.current,
      );
      speakFromGlobalIndex(resumeFrom, { rate, voiceName: newVoiceName });
    },
    [rate, speakFromGlobalIndex],
  );

  useEffect(() => {
    spreadHydratedRef.current = false;
    setBookmark(readReadingBookmark(documentId));
  }, [documentId]);

  useEffect(() => {
    setBookmark(readReadingBookmark(documentId));
  }, [documentId, leftPage]);

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
      if (pending.chapterId) {
        scrollToChapterMarker(container, pending.chapterId);
        return;
      }

      scrollToReadingPosition(container, pending.charOffset);
    });
  }, [leftPage, rightPage, syncTextRefs]);

  useEffect(() => {
    if (!pagesReady || spreadHydratedRef.current) {
      return;
    }
    spreadHydratedRef.current = true;
    const spreadLeft = leftPageForTarget(initialPage, totalPages, spreadMode);
    setLeftPage(spreadLeft);
    bookRef.current?.turnToPage(spreadLeft - 1);
  }, [initialPage, pagesReady, spreadMode, totalPages]);

  useEffect(() => {
    if (!pagesReady) {
      return;
    }
    syncTextRefs();
    applyPendingScroll();
  }, [applyPendingScroll, leftPage, pagesReady, syncTextRefs]);

  const handleBookmark = useCallback(() => {
    const saved: ReadingBookmark = {
      documentId,
      page: leftPage,
      savedAt: Date.now(),
    };

    writeReadingBookmark(saved);
    setBookmark(saved);
    progressMutation.mutate(leftPage);
  }, [documentId, leftPage, progressMutation]);

  const isBookmarkedHere = bookmark?.page === leftPage;

  const scrollToChapter = useCallback(
    (chapter: BookChapter) => {
      pendingScrollRef.current = {
        page: chapter.pageNumber,
        chapterId: chapter.id,
      };

      const targetLeft = leftPageForTarget(chapter.pageNumber, totalPages, spreadMode);
      if (targetLeft === leftPage) {
        syncTextRefs();
        window.requestAnimationFrame(() => {
          const container = document.querySelector(
            `[data-flipbook-page="${chapter.pageNumber}"] .reader-page__text`,
          ) as HTMLDivElement | null;
          if (container) {
            scrollToChapterMarker(container, chapter.id);
          }
          pendingScrollRef.current = null;
        });
        return;
      }

      changeSpread(targetLeft, { animate: true });
    },
    [changeSpread, leftPage, spreadMode, syncTextRefs, totalPages],
  );

  const handleSpreadModeToggle = useCallback(() => {
    const nextMode: ReaderSpreadMode = spreadMode === "double" ? "single" : "double";
    const targetPage = leftPageForTarget(leftPage, totalPages, nextMode);
    setSpreadMode(nextMode);
    writeSpreadModePreference(nextMode);
    setLeftPage(targetPage);
    bookRef.current?.turnToPage(targetPage - 1);
  }, [leftPage, spreadMode, totalPages]);

  const handleSearchNavigate = useCallback(
    (targetLeftPage: number) => {
      changeSpread(targetLeftPage);
    },
    [changeSpread],
  );

  useEffect(
    () => () => {
      cancelSpeech();
      clearAllTtsHighlights();
    },
    [cancelSpeech],
  );

  useEffect(() => {
    setFullscreenMounted(true);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || !pagesReady) {
      return;
    }

    const syncLayout = () => {
      bookRef.current?.turnToPage(leftPage - 1);
      bookRef.current?.remeasure();
    };

    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(syncLayout);
    });
    const timer = window.setTimeout(syncLayout, 120);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [isFullscreen, leftPage, pagesReady]);

  useEffect(() => {
    if (!isFullscreen || !fullscreenRef.current) {
      return;
    }

    const element = fullscreenRef.current;
    void element.requestFullscreen?.().catch(() => {
      // Fixed overlay still works when the Fullscreen API is unavailable.
    });
  }, [isFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, []);

  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const title = metaQuery.data?.title ?? "Loading...";
  const viewEnd = viewEndPage(leftPage, totalPages, spreadMode);
  const viewLabel = formatViewLabel(leftPage, totalPages, spreadMode);
  const viewOptions = viewPageOptions(totalPages, spreadMode);
  const canGoPrev = leftPage > 1 && !navLocked;
  const canGoNext = nextViewPage(leftPage, totalPages, spreadMode) !== leftPage && !navLocked;
  const currentChapterId = resolveActiveChapterId(chapters, viewEnd);

  const bookStage = (
    <ReaderBookStage
      pagesReady={pagesReady}
      readerPages={readerPages}
      startPageIndex={leftPage - 1}
      spreadMode={spreadMode}
      zoom={zoom}
      onZoomChange={setZoom}
      onFlip={handleBookFlip}
      onFlippingChange={setNavLocked}
      bookRef={bookRef}
      canGoPrev={canGoPrev}
      canGoNext={canGoNext}
      onPrev={() => changeSpread((p) => prevViewPage(p, spreadMode), { animate: true })}
      onNext={() => changeSpread((p) => nextViewPage(p, totalPages, spreadMode), { animate: true })}
    />
  );

  const fullscreenOverlay =
    isFullscreen && fullscreenMounted
      ? createPortal(
          <div ref={fullscreenRef} className="reader-fullscreen">
            <ReaderFullscreenNav from={from} onExitView={exitFullscreen} />
            <p className="reader-fullscreen__meta">
              {title} · {spreadMode === "single" ? "Page" : "Pages"} {leftPage}
              {viewEnd !== leftPage ? `–${viewEnd}` : ""} of {totalPages}
            </p>
            <div className="reader-fullscreen__stage-area">{bookStage}</div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="reader-shell min-h-0 flex-1">
      <header className="reader-header">
        <div className="reader-header__row">
          <h1 className="reader-header__title">{title}</h1>
          {pagesReady ? (
            <BookSearchPanel
              pages={pages}
              spreadMode={spreadMode}
              totalPages={totalPages}
              currentPage={leftPage}
              navLocked={navLocked}
              onNavigate={handleSearchNavigate}
            />
          ) : null}
        </div>
        <p className="reader-header__meta">
          {spreadMode === "single" ? "Page" : "Pages"} {leftPage}
          {viewEnd !== leftPage ? `–${viewEnd}` : ""} of {totalPages}
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
                  aria-pressed={isBookmarkedHere}
                  className={`reader-controls__button reader-controls__button--bookmark${
                    isBookmarkedHere ? " reader-controls__button--bookmarked" : ""
                  }`}
                >
                  {isBookmarkedHere ? "Bookmarked" : "Bookmark"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowFullSummary(true)}
                className="reader-controls__button reader-controls__button--ai-summary"
              >
                AI Summary
              </button>
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => changeSpread((p) => prevViewPage(p, spreadMode), { animate: true })}
                className="reader-controls__button disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() =>
                  changeSpread((p) => nextViewPage(p, totalPages, spreadMode), { animate: true })
                }
                className="reader-controls__button disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                type="button"
                onClick={handleSpreadModeToggle}
                className="reader-controls__button reader-controls__button--layout"
                aria-pressed={spreadMode === "single"}
              >
                {spreadMode === "single" ? "Double Split" : "Single Split"}
              </button>
              <button
                type="button"
                onClick={enterFullscreen}
                disabled={!pagesReady}
                className="reader-controls__button reader-controls__button--fullscreen"
              >
                Full Screen
              </button>
              <label className="reader-controls__field">
                Jump to
                <select
                  value={leftPage}
                  onChange={(e) => changeSpread(Number(e.target.value))}
                  className="reader-controls__select reader-controls__select--spread"
                  aria-label={`Jump to ${spreadMode === "single" ? "page" : "pages"} ${viewLabel}`}
                >
                  {viewOptions.map((pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {formatViewLabel(pageNumber, totalPages, spreadMode)}
                    </option>
                  ))}
                </select>
              </label>
            </nav>

            <section className="reader-audio" aria-label="Audio reader">
              <span className="reader-audio__label">Audio reader</span>
              {!playing ? (
                <button type="button" onClick={beginSpeech} className="reader-controls__button">
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
                  onChange={(e) => handleRateChange(Number(e.target.value))}
                  className="reader-controls__select"
                  aria-label="Speech rate"
                >
                  <option value={0.5}>0.5×</option>
                  <option value={0.75}>0.75×</option>
                  <option value={1}>1×</option>
                  <option value={1.25}>1.25×</option>
                  <option value={1.5}>1.5×</option>
                </select>
              </label>
              {sortedVoices.length > 0 && (
                <label className="reader-controls__field">
                  Voice
                  <select
                    value={voiceName}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="reader-controls__select max-w-[12rem]"
                    aria-label="Voice selection"
                  >
                    {sortedVoices.map((voice) => (
                      <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          </aside>

          <div className="reader-stage-area">{!isFullscreen ? bookStage : null}</div>

          <ChapterNavStrip
            chapters={chapters}
            activeChapterId={currentChapterId}
            onSelect={scrollToChapter}
          />
        </div>
      )}

      {showFullSummary && metaQuery.data ? (
        <BookFullSummaryModal
          documentId={documentId}
          title={metaQuery.data.title}
          onClose={() => setShowFullSummary(false)}
        />
      ) : null}

      {fullscreenOverlay}
    </div>
  );
}

function ReaderFullscreenNav({
  from,
  onExitView,
}: {
  from: "library" | "docket";
  onExitView: () => void;
}) {
  const root =
    from === "docket"
      ? { label: "Docket", href: "/dashboard/docket" }
      : { label: "Library", href: "/dashboard/library" };

  return (
    <nav aria-label="Breadcrumb" className="reader-fullscreen__nav">
      <ol className="reader-fullscreen__crumbs">
        <li>
          <Link href={root.href} className="reader-fullscreen__crumb-link">
            {root.label}
          </Link>
        </li>
        <li className="reader-fullscreen__crumb-sep" aria-hidden>
          /
        </li>
        <li>
          <button type="button" onClick={onExitView} className="reader-fullscreen__crumb-button">
            View
          </button>
        </li>
        <li className="reader-fullscreen__crumb-sep" aria-hidden>
          /
        </li>
        <li>
          <span className="reader-fullscreen__crumb-current" aria-current="page">
            Full Screen
          </span>
        </li>
      </ol>
    </nav>
  );
}

function ReaderBookStage({
  pagesReady,
  readerPages,
  startPageIndex,
  spreadMode,
  zoom,
  onZoomChange,
  onFlip,
  onFlippingChange,
  bookRef,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: {
  pagesReady: boolean;
  readerPages: Array<{ pageNumber: number; content: string }>;
  startPageIndex: number;
  spreadMode: ReaderSpreadMode;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFlip: (pageIndex: number) => void;
  onFlippingChange: (flipping: boolean) => void;
  bookRef: React.RefObject<StPageFlipBookHandle | null>;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="reader-stage w-full">
      <PageTurnButton direction="prev" disabled={!canGoPrev} onClick={onPrev} />
      <div className="reader-book min-w-0">
        {!pagesReady ? (
          <p className="reader-flipbook-loading">Preparing book...</p>
        ) : (
          <>
            <StPageFlipBook
              ref={bookRef}
              pages={readerPages}
              startPageIndex={startPageIndex}
              spreadMode={spreadMode}
              zoom={zoom}
              onZoomChange={onZoomChange}
              onFlip={onFlip}
              onFlippingChange={onFlippingChange}
            />
            <div className="reader-book__zoom-controls" role="group" aria-label="Zoom">
              <BookZoomButton
                label="Zoom out"
                disabled={zoom <= READER_ZOOM_MIN}
                onClick={() => onZoomChange(clampReaderZoom(zoom - READER_ZOOM_STEP))}
              >
                −
              </BookZoomButton>
              <BookZoomButton
                label="Zoom in"
                disabled={zoom >= READER_ZOOM_MAX}
                onClick={() => onZoomChange(clampReaderZoom(zoom + READER_ZOOM_STEP))}
              >
                +
              </BookZoomButton>
            </div>
          </>
        )}
      </div>
      <PageTurnButton direction="next" disabled={!canGoNext} onClick={onNext} />
    </div>
  );
}

function BookZoomButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="reader-book__zoom-btn"
    >
      {children}
    </button>
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
