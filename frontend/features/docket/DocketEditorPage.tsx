"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { DraftEditor, type DraftEditorHandle } from "@/features/docket/DraftEditor";
import { PublishDialog } from "@/features/docket/PublishDialog";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  clearDraftCheckpoint,
  migrateDraftCheckpoint,
  readDraftCheckpoint,
  resolveDraftContent,
  shouldWriteDraftCheckpoint,
  writeDraftCheckpoint,
} from "@/lib/draft-checkpoint";
import { ensurePaginatedHtml } from "@/lib/paginate-html";

interface DocketEditorPageProps {
  documentId?: string;
}

export function DocketEditorPage({ documentId }: DocketEditorPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editorRef = useRef<DraftEditorHandle>(null);
  const hydratedIdRef = useRef<string | null>(null);
  const [title, setTitle] = useState("Untitled draft");
  const [content, setContent] = useState("");
  const [isHydrated, setIsHydrated] = useState(!documentId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
        setContent(ensurePaginatedHtml(checkpoint.content));
      }
      hydratedIdRef.current = hydrationKey;
      setIsHydrated(true);
      return;
    }

    if (!docQuery.isSuccess) {
      return;
    }

    const doc = docQuery.data.document;
    const checkpoint = readDraftCheckpoint(documentId);
    const resolved = resolveDraftContent(doc.title, doc.content ?? "", checkpoint);

    setTitle(resolved.title);
    const paginated = ensurePaginatedHtml(resolved.content);
    setContent(paginated);
    if (paginated) {
      writeDraftCheckpoint(documentId, resolved.title, paginated);
    }

    hydratedIdRef.current = hydrationKey;
    setIsHydrated(true);
  }, [documentId, docQuery.isSuccess, docQuery.data]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!shouldWriteDraftCheckpoint(documentId, title, content)) {
        return;
      }
      writeDraftCheckpoint(documentId, title, content);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [isHydrated, documentId, title, content]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const latestTitle = title.trim() || "Untitled draft";
      const fromEditor = editorRef.current?.getContent() ?? "";
      const latestContent =
        fromEditor && fromEditor !== "<p></p>" ? fromEditor : content;
      if (documentId) {
        return api.updateDocument(documentId, latestTitle, latestContent);
      }
      return api.createDocument(latestTitle, latestContent);
    },
    onSuccess: (data) => {
      const saved = data.document;
      const fromEditor = editorRef.current?.getContent() ?? "";
      const latestContent =
        fromEditor && fromEditor !== "<p></p>" ? fromEditor : content;

      setTitle(saved.title);
      setContent(latestContent);
      setMessage("Draft saved.");
      setError(null);

      queryClient.setQueryData(["document", saved.id], {
        document: { ...saved, content: latestContent },
      });
      queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });

      writeDraftCheckpoint(saved.id, saved.title, latestContent);

      if (!documentId) {
        migrateDraftCheckpoint(undefined, saved.id);
        hydratedIdRef.current = saved.id;
        setIsHydrated(true);
        router.replace(`/dashboard/docket/editor/${saved.id}`);
        return;
      }

      hydratedIdRef.current = documentId;
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
        <p className="text-sm text-muted">Loading editor...</p>
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
              key={documentId ?? "new"}
              ref={editorRef}
              content={content}
              onChange={setContent}
              disabled={!isDraft}
              placeholder={
                isDraft
                  ? "Start writing, paste, or import a document..."
                  : "Published — read-only view"
              }
            />
          ) : (
            <p className="text-sm text-muted">Loading editor...</p>
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
          content={editorRef.current?.getContent() ?? content}
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
