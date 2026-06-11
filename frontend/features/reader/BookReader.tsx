"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/services/api";

interface BookReaderProps {
  documentId: string;
  initialPage?: number;
}

export function BookReader({ documentId, initialPage = 1 }: BookReaderProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(initialPage);
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const pageQuery = useQuery({
    queryKey: ["document-page", documentId, page],
    queryFn: async () => (await api.getDocumentPage(documentId, page)).page,
    enabled: Boolean(documentId),
  });

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
      pageQuery.refetch();
    },
  });

  const accessDenied =
    pageQuery.error instanceof ApiError && pageQuery.error.status === 403;

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    utteranceRef.current = null;
  }, []);

  const speakPage = useCallback(() => {
    const text = pageQuery.data?.content;
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
  }, [pageQuery.data?.content, rate, stopSpeech]);

  useEffect(() => {
    stopSpeech();
  }, [page, stopSpeech]);

  useEffect(() => {
    if (pageQuery.isSuccess) {
      progressMutation.mutate(page);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageQuery.isSuccess]);

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const totalPages = pageQuery.data?.totalPages ?? 1;
  const title = pageQuery.data?.title ?? "Loading...";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b-2 border-border pb-4">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted">
          Page {page} of {totalPages}
        </p>
      </header>

      {pageQuery.isLoading && (
        <p className="text-sm text-muted">Loading page...</p>
      )}

      {accessDenied && previewQuery.data && (
        <div className="flex flex-col gap-4 border-2 border-foreground bg-surface p-4">
          <p className="text-sm text-foreground">
            Subscribe to {previewQuery.data.authorEmail} to read the full book.
            The book will be saved to your docket automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={subscribeMutation.isPending}
              onClick={() => subscribeMutation.mutate()}
              className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              {subscribeMutation.isPending ? "Subscribing..." : "Subscribe to read"}
            </button>
            <Link
              href="/dashboard/library"
              className="border-2 border-foreground px-4 py-2 text-sm text-foreground"
            >
              Back to library
            </Link>
          </div>
        </div>
      )}

      {pageQuery.error && !accessDenied && (
        <p className="text-sm text-foreground" role="alert">
          Unable to load this page.
        </p>
      )}

      {pageQuery.data && (
        <article className="prose max-w-none whitespace-pre-wrap border-2 border-foreground bg-surface p-6 text-foreground">
          {pageQuery.data.content}
        </article>
      )}

      <nav
        className="flex flex-wrap items-center gap-3"
        aria-label="Reading controls"
      >
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="border-2 border-foreground bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="border-2 border-foreground bg-background px-4 py-2 text-sm text-foreground disabled:opacity-50"
        >
          Next
        </button>
        <label className="flex items-center gap-2 text-sm text-foreground">
          Jump to
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (next >= 1 && next <= totalPages) setPage(next);
            }}
            className="w-16 border-2 border-foreground bg-surface px-2 py-1"
          />
        </label>
      </nav>

      <section
        className="flex flex-wrap items-center gap-3 border-t-2 border-border pt-4"
        aria-label="Audio reader"
      >
        <span className="text-sm font-medium text-foreground">Audio reader</span>
        {!playing ? (
          <button
            type="button"
            onClick={speakPage}
            className="border-2 border-foreground bg-surface px-3 py-1 text-sm text-foreground"
          >
            Play
          </button>
        ) : (
          <button
            type="button"
            onClick={stopSpeech}
            className="border-2 border-foreground bg-surface px-3 py-1 text-sm text-foreground"
          >
            Stop
          </button>
        )}
        <label className="flex items-center gap-2 text-sm text-foreground">
          Speed
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="border-2 border-foreground bg-surface px-2 py-1"
            aria-label="Speech rate"
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
            <option value={1.5}>1.5×</option>
          </select>
        </label>
        {typeof window !== "undefined" && window.speechSynthesis && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            Voice
            <select
              className="max-w-[12rem] border-2 border-foreground bg-surface px-2 py-1"
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
    </div>
  );
}
