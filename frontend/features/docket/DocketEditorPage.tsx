"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "@/services/api";
import {
  DraftEditor,
  type DraftDocumentPayload,
  type DraftEditorHandle,
} from "@/features/docket/DraftEditor";
import { PublishDialog } from "@/features/docket/PublishDialog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingBuffer } from "@/components/ui/LoadingBuffer";
import {
  clearDraftCheckpoint,
  migrateDraftCheckpoint,
  readDraftCheckpoint,
  resolveDraftContent,
  shouldWriteDraftCheckpoint,
  writeDraftCheckpoint,
} from "@/lib/draft-checkpoint";
import type { DocumentContentFormat } from "@/lib/docx-content";
import {
  arrayBufferToBase64,
  base64ToArrayBufferAsync,
  htmlToDocxBuffer,
  normalizeEditorContent,
  tryDocxBufferToReaderHtml,
} from "@/lib/docx-content";
import {
  migrationCacheKey,
  readCachedDocx,
} from "@/lib/docx-migration-cache";

interface DocketEditorPageProps {
  documentId?: string;
}

const EMPTY_PAYLOAD: DraftDocumentPayload = {
  content: "",
  contentFormat: "docx",
};

export function DocketEditorPage({ documentId }: DocketEditorPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editorRef = useRef<DraftEditorHandle>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("Untitled draft");
  const [draftPayload, setDraftPayload] = useState<DraftDocumentPayload>(EMPTY_PAYLOAD);
  const [isHydrated, setIsHydrated] = useState(!documentId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editorReloadKey, setEditorReloadKey] = useState(0);
  const [aiChecking, setAiChecking] = useState(false);
  const persistedDocxRef = useRef(false);
  const serverWasHtmlRef = useRef(false);

  const docQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => api.getDocument(documentId!),
    enabled: Boolean(documentId),
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    setIsHydrated(!documentId);
    hydratedIdRef.current = null;
  }, [documentId]);

  useEffect(() => {
    const hydrationKey = documentId ?? "new";
    if (hydratedIdRef.current === hydrationKey) {
      return;
    }

    if (!documentId) {
      const checkpoint = readDraftCheckpoint();
      if (checkpoint) {
        setTitle(checkpoint.title || "Untitled draft");
        setDraftPayload({
          content: checkpoint.content,
          contentFormat: checkpoint.contentFormat,
          readerHtml: checkpoint.readerHtml,
        });
      }
      hydratedIdRef.current = hydrationKey;
      setIsHydrated(true);
      return;
    }

    if (!docQuery.isSuccess) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const doc = docQuery.data.document;
      const checkpoint = readDraftCheckpoint(documentId);
      const serverContent = normalizeEditorContent(
        doc.content ?? "",
        (doc.contentFormat as DocumentContentFormat) ?? "html",
      );
      serverWasHtmlRef.current = serverContent.contentFormat === "html";
      persistedDocxRef.current = serverContent.contentFormat === "docx";

      let resolved = resolveDraftContent(
        doc.title,
        serverContent.content,
        serverContent.contentFormat,
        undefined,
        checkpoint,
      );

      if (resolved.contentFormat === "html") {
        const cacheKey = migrationCacheKey(documentId);
        if (cacheKey) {
          const cached = await readCachedDocx(cacheKey);
          if (cached) {
            resolved = {
              title: resolved.title,
              content: arrayBufferToBase64(cached),
              contentFormat: "docx",
              readerHtml: resolved.content,
            };
          }
        }
      }

      if (resolved.contentFormat === "docx" && resolved.content.length > 48) {
        try {
          await base64ToArrayBufferAsync(resolved.content);
        } catch {
          resolved = {
            title: doc.title,
            content: serverContent.content,
            contentFormat: serverContent.contentFormat,
            readerHtml: serverContent.contentFormat === "html" ? serverContent.content : undefined,
          };
        }
      }

      if (cancelled) {
        return;
      }

      setTitle(resolved.title);
      setDraftPayload({
        content: resolved.content,
        contentFormat: resolved.contentFormat,
        readerHtml: resolved.readerHtml,
      });
      if (resolved.content) {
        writeDraftCheckpoint(
          documentId,
          resolved.title,
          resolved.content,
          resolved.contentFormat,
          resolved.readerHtml,
        );
      }

      hydratedIdRef.current = hydrationKey;
      setIsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, docQuery.isSuccess, docQuery.data]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (
        !shouldWriteDraftCheckpoint(
          documentId,
          title,
          draftPayload.content,
          draftPayload.contentFormat,
        )
      ) {
        return;
      }
      writeDraftCheckpoint(
        documentId,
        title,
        draftPayload.content,
        draftPayload.contentFormat,
        draftPayload.readerHtml,
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isHydrated, documentId, title, draftPayload]);

  const persistMigratedDocx = useCallback(
    (payload: DraftDocumentPayload) => {
      if (
        !documentId ||
        persistedDocxRef.current ||
        payload.contentFormat !== "docx" ||
        payload.content.length <= 48 ||
        !serverWasHtmlRef.current
      ) {
        return;
      }

      persistedDocxRef.current = true;
      const latestTitle = title.trim() || "Untitled draft";
      void api
        .updateDocument(documentId, {
          title: latestTitle,
          content: payload.content,
          contentFormat: "docx",
          readerHtml: payload.readerHtml,
        })
        .then((data) => {
          serverWasHtmlRef.current = false;
          queryClient.setQueryData(["document", documentId], data);
        })
        .catch(() => {
          persistedDocxRef.current = false;
        });
    },
    [documentId, queryClient, title],
  );

  const handleDraftPayloadChange = useCallback(
    (payload: DraftDocumentPayload) => {
      if (payload.contentFormat === "docx" && payload.content.length <= 48) {
        return;
      }
      setDraftPayload(payload);
      persistMigratedDocx(payload);
    },
    [persistMigratedDocx],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const latestTitle = title.trim() || "Untitled draft";
      let fromEditor: DraftDocumentPayload | null = null;
      try {
        fromEditor = (await editorRef.current?.getDocumentPayload()) ?? null;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not read the document from the editor.";
        throw new Error(message);
      }
      if (!fromEditor?.content) {
        throw new Error("Nothing to save — the editor returned an empty document.");
      }
      const payload = {
        title: latestTitle,
        content: fromEditor.content,
        contentFormat: fromEditor.contentFormat,
        readerHtml: fromEditor.readerHtml,
      };
      if (documentId) {
        return api.updateDocument(documentId, payload);
      }
      return api.createDocument(payload);
    },
    onSuccess: (data) => {
      const saved = data.document;
      void (async () => {
        let fromEditor: DraftDocumentPayload | null = null;
        try {
          fromEditor = await editorRef.current?.getDocumentPayload() ?? null;
        } catch {
          fromEditor = null;
        }
        const payload = fromEditor ?? draftPayload;
        setTitle(saved.title);
        setDraftPayload(payload);
        setMessage("Draft saved.");
        setError(null);

        queryClient.setQueryData(["document", saved.id], {
          document: {
            ...saved,
            content: payload.content,
            contentFormat: payload.contentFormat,
          },
        });
        queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });

        writeDraftCheckpoint(
          saved.id,
          saved.title,
          payload.content,
          payload.contentFormat,
          payload.readerHtml,
        );

        if (!documentId) {
          migrateDraftCheckpoint(undefined, saved.id);
          hydratedIdRef.current = saved.id;
          setIsHydrated(true);
          router.replace(`/dashboard/docket/editor/${saved.id}`);
          return;
        }

        hydratedIdRef.current = documentId;
      })();
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteDocument(documentId!),
    onSuccess: () => {
      clearDraftCheckpoint(documentId);
      queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
      router.push("/dashboard/docket");
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleAiCheck = useCallback(async () => {
    setAiChecking(true);
    setError(null);
    setMessage(null);
    try {
      const fromEditor = (await editorRef.current?.getDocumentPayload()) ?? draftPayload;
      let sourceText = fromEditor.readerHtml ?? "";
      if (!sourceText && fromEditor.contentFormat === "docx" && fromEditor.content) {
        const buffer = await base64ToArrayBufferAsync(fromEditor.content);
        sourceText = (await tryDocxBufferToReaderHtml(buffer)) ?? "";
      }
      const plain = htmlToPlainTextForAi(sourceText || fromEditor.content);
      if (!plain.trim()) {
        throw new Error("Add some text before running AI check.");
      }

      const { result } = await api.aiProofread(plain);
      const docxBuffer = await htmlToDocxBuffer(result.correctedHtml);
      const nextPayload: DraftDocumentPayload = {
        content: arrayBufferToBase64(docxBuffer),
        contentFormat: "docx",
        readerHtml: result.correctedHtml,
      };
      setDraftPayload(nextPayload);
      setEditorReloadKey((value) => value + 1);
      setMessage(
        result.usedAi
          ? "AI check applied — grammar and phrasing updated."
          : "Proofread complete (AI token not configured; text normalized only).",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI check failed.");
    } finally {
      setAiChecking(false);
    }
  }, [draftPayload]);

  const document = docQuery.data?.document;
  const isDraft = !documentId || document?.status === "DRAFT";
  const loading = Boolean(documentId) && (!docQuery.isSuccess || !isHydrated);

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Breadcrumbs
          items={[
            { label: "Docket", href: "/dashboard/docket" },
            { label: "My Editor" },
          ]}
        />
        <div className="wireframe-panel flex min-h-0 flex-1 flex-col border-2 border-foreground bg-background">
          <section className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
            <LoadingBuffer
              title="Loading manuscript…"
              detail="Fetching your draft. Large scripts may take longer."
            />
          </section>
        </div>
      </div>
    );
  }

  if (documentId && docQuery.isError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Breadcrumbs
          items={[
            { label: "Docket", href: "/dashboard/docket" },
            { label: "My Editor" },
          ]}
        />
        <p className="text-sm text-danger" role="alert">
          Could not load this draft.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: "Docket", href: "/dashboard/docket" },
            { label: "My Editor" },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => void handleAiCheck()}
                disabled={aiChecking}
                className="border-2 border-foreground px-4 py-2 text-sm font-bold uppercase disabled:opacity-50"
              >
                {aiChecking ? "AI checking…" : "AI check"}
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="border-2 border-foreground px-4 py-2 text-sm font-bold uppercase"
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
              {documentId && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPublish(true)}
                    className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background"
                  >
                    Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={deleteMutation.isPending}
                    className="border-2 border-foreground px-4 py-2 text-sm uppercase"
                  >
                    Delete
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="wireframe-panel flex min-h-0 flex-1 flex-col border-2 border-foreground bg-background">
        <section className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!isDraft}
            placeholder="Draft title"
            className="shrink-0 border-2 border-foreground bg-background px-3 py-2 font-bold disabled:opacity-70"
          />

          {isHydrated ? (
            <DraftEditor
              key={`${documentId ?? "new"}-${editorReloadKey}`}
              ref={editorRef}
              documentId={documentId}
              content={draftPayload.content}
              contentFormat={draftPayload.contentFormat}
              onChange={handleDraftPayloadChange}
              disabled={!isDraft}
              placeholder={
                isDraft
                  ? "Start writing, paste, or import a document..."
                  : "Published — read-only view"
              }
            />
          ) : (
            <LoadingBuffer
              title="Loading editor…"
              detail="Preparing the writing surface."
            />
          )}
        </section>
      </div>

      {message && <p className="shrink-0 text-sm text-success">{message}</p>}
      {error && (
        <p className="shrink-0 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {showPublish && documentId && (
        <PublishDialog
          documentId={documentId}
          title={title}
          getPayload={async () =>
            (await editorRef.current?.getDocumentPayload()) ?? draftPayload
          }
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            setShowPublish(false);
            queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
            queryClient.invalidateQueries({ queryKey: ["document", documentId] });
          }}
        />
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-draft-title"
        >
          <div className="w-full max-w-md border-2 border-foreground bg-background p-6">
            <h2 id="delete-draft-title" className="text-lg font-bold">
              Are you sure you want to delete?
            </h2>
            <p className="mt-2 text-sm text-muted">
              This draft will be permanently removed from your docket.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="border-2 border-foreground px-4 py-2 text-sm uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function htmlToPlainTextForAi(value: string): string {
  if (!value) {
    return "";
  }
  if (typeof document !== "undefined" && /<[^>]+>/.test(value)) {
    const wrap = document.createElement("div");
    wrap.innerHTML = value;
    return wrap.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
