"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, NetworkError } from "@/services/api";
import type { DocumentSummary } from "@/services/api";
import { PublishDialog } from "@/features/docket/PublishDialog";
import { DraftEditor } from "@/features/docket/DraftEditor";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export function DocketWorkspace() {
  const user = useAuthStore((s) => s.user);
  const isAuthor = user ? roles.hasAtLeast(user.role, roles.Author) : false;
  const queryClient = useQueryClient();

  const workspaceQuery = useQuery({
    queryKey: ["docket-workspace", user?.id, user?.role],
    queryFn: api.getDocketWorkspace,
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: false,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);

  const docQuery = useQuery({
    queryKey: ["document", selectedId],
    queryFn: () => api.getDocument(selectedId!),
    enabled: Boolean(selectedId) && isAuthor,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const doc = docQuery.data?.document;
    if (!doc || doc.id !== selectedId) {
      return;
    }
    setTitle(doc.title);
    setContent(doc.content ?? "");
  }, [docQuery.data?.document?.id, selectedId]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateDocument(selectedId!, title, content),
    onSuccess: () => {
      setMessage("Draft saved.");
      queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () => api.createDocument(title || "Untitled draft", content),
    onSuccess: (data) => {
      setSelectedId(data.document.id);
      queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const autosave = useCallback(() => {
    if (!selectedId || !isAuthor) return;
    const doc = workspaceQuery.data?.drafts.find((d) => d.id === selectedId);
    if (doc?.status === "DRAFT") saveMutation.mutate();
  }, [selectedId, isAuthor, workspaceQuery.data, saveMutation]);

  useEffect(() => {
    const onUnload = () => {
      if (selectedId && isAuthor) autosave();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [selectedId, isAuthor, autosave]);

  useEffect(() => {
    if (!selectedId || !isAuthor) return;
    const timer = setInterval(autosave, 30_000);
    return () => clearInterval(timer);
  }, [selectedId, isAuthor, autosave]);

  const ws = workspaceQuery.data;
  const selected = docQuery.data?.document;
  const isDraft = selected?.status === "DRAFT";

  const selectDoc = (doc: DocumentSummary) => {
    setSelectedId(doc.id);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="wireframe-panel flex min-h-[70vh] flex-col border-2 border-foreground md:flex-row">
        <aside className="w-full border-b-2 border-foreground bg-surface p-4 md:w-72 md:border-b-0 md:border-r-2">
          <section className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wide">Subscribed</h2>
            <p className="mt-1 text-xs text-muted">Phase 4: library subscriptions</p>
            {ws?.subscribedItems.length === 0 && (
              <p className="mt-2 text-sm text-muted">No subscriptions yet.</p>
            )}
          </section>

          {isAuthor && (
            <>
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase">Drafts</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setTitle("New draft");
                      setContent("");
                    }}
                    className="border border-foreground px-2 py-0.5 text-xs font-bold uppercase"
                  >
                    New
                  </button>
                </div>
                <DocList items={ws?.drafts ?? []} selectedId={selectedId} onSelect={selectDoc} />
              </section>
              <section>
                <h2 className="mb-2 text-xs font-bold uppercase">Published</h2>
                <DocList items={ws?.published ?? []} selectedId={selectedId} onSelect={selectDoc} />
              </section>
            </>
          )}

          {!isAuthor && (
            <p className="text-sm text-muted">
              Your personal docket is ready. Apply for author status to write manuscripts.
            </p>
          )}
        </aside>

        <section className="flex flex-1 flex-col bg-background p-4">
          {!isAuthor ? (
            <ReaderDocketPanel ws={ws} />
          ) : !selectedId ? (
            <AuthorNewDraftPanel
              title={title}
              content={content}
              onTitle={setTitle}
              onContent={setContent}
              onCreate={() => createMutation.mutate()}
              creating={createMutation.isPending}
            />
          ) : (
            <AuthorEditorPanel
              title={title}
              content={content}
              isDraft={isDraft}
              onTitle={setTitle}
              onContent={setContent}
              onSave={() => saveMutation.mutate()}
              onPublish={() => setShowPublish(true)}
              onDelete={async () => {
                await api.deleteDocument(selectedId);
                setSelectedId(null);
                queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
              }}
              saving={saveMutation.isPending}
              selectedId={selectedId}
            />
          )}
        </section>
      </div>

      {message && <p className="text-sm text-success">{message}</p>}
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}

      {showPublish && selectedId && isAuthor && (
        <PublishDialog
          documentId={selectedId}
          title={title}
          content={content}
          onClose={() => setShowPublish(false)}
          onPublished={() => {
            setShowPublish(false);
            queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
            queryClient.invalidateQueries({ queryKey: ["document", selectedId] });
          }}
        />
      )}
    </div>
  );
}

function DocList({
  items,
  selectedId,
  onSelect,
}: {
  items: DocumentSummary[];
  selectedId: string | null;
  onSelect: (d: DocumentSummary) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            onClick={() => onSelect(doc)}
            className={`w-full border-2 border-foreground px-2 py-2 text-left text-sm hover:bg-background ${
              selectedId === doc.id ? "bg-background font-bold" : ""
            }`}
          >
            <span className="block truncate">{doc.title}</span>
            <span className="mt-1 text-xs uppercase text-muted">{doc.status}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ReaderDocketPanel({ ws }: { ws?: Awaited<ReturnType<typeof api.getDocketWorkspace>> }) {
  const booksQuery = useQuery({
    queryKey: ["docket-books"],
    queryFn: async () => (await api.getDocketBooks()).books,
  });

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-bold">Your Docket</h2>
      <p className="text-sm text-muted">
        Issued books, reading progress, and author subscriptions live here.
      </p>
      <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <div className="border-2 border-foreground p-3">
          <dt className="text-xs font-bold uppercase">Issued books</dt>
          <dd className="mt-1 text-2xl font-bold">{booksQuery.data?.length ?? 0}</dd>
        </div>
        <div className="border-2 border-foreground p-3">
          <dt className="text-xs font-bold uppercase">Saved books</dt>
          <dd className="mt-1 text-2xl font-bold">{ws?.savedBooks.length ?? 0}</dd>
        </div>
        <div className="border-2 border-foreground p-3">
          <dt className="text-xs font-bold uppercase">Subscriptions</dt>
          <dd className="mt-1 text-2xl font-bold">{ws?.subscribedItems.length ?? 0}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide">Continue reading</h3>
        {booksQuery.isLoading && (
          <p className="text-sm text-muted">Loading issued books...</p>
        )}
        {booksQuery.data && booksQuery.data.length === 0 && (
          <p className="text-sm text-muted">
            No issued books yet. Browse the{" "}
            <Link href="/dashboard/library" className="underline">
              library
            </Link>{" "}
            to issue a title.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {booksQuery.data?.map((book) => (
            <li
              key={book.documentId}
              className="flex flex-wrap items-center justify-between gap-2 border-2 border-foreground p-3"
            >
              <div>
                <p className="font-bold text-foreground">{book.title}</p>
                <p className="text-xs text-muted">
                  Page {book.currentPage} · {Math.round(book.completionPercentage)}% complete
                </p>
              </div>
              <Link
                href={`/dashboard/read/${book.documentId}?page=${book.currentPage}`}
                className="border-2 border-foreground bg-foreground px-3 py-1 text-sm font-medium text-background"
              >
                Continue
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AuthorNewDraftPanel({
  title,
  content,
  onTitle,
  onContent,
  onCreate,
  creating,
}: {
  title: string;
  content: string;
  onTitle: (v: string) => void;
  onContent: (v: string) => void;
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        placeholder="Draft title"
        className="border-2 border-foreground bg-background px-3 py-2 font-bold"
      />
      <DraftEditor content={content} onChange={onContent} />
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="self-start border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background"
      >
        Create draft
      </button>
    </div>
  );
}

function AuthorEditorPanel({
  title,
  content,
  isDraft,
  onTitle,
  onContent,
  onSave,
  onPublish,
  onDelete,
  saving,
  selectedId,
}: {
  title: string;
  content: string;
  isDraft: boolean;
  onTitle: (v: string) => void;
  onContent: (v: string) => void;
  onSave: () => void;
  onPublish: () => void;
  onDelete: () => void;
  saving: boolean;
  selectedId: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        disabled={!isDraft}
        className="border-2 border-foreground bg-background px-3 py-2 font-bold disabled:opacity-70"
      />
      <DraftEditor
        content={content}
        onChange={onContent}
        disabled={!isDraft}
        placeholder={isDraft ? "Write or import your manuscript..." : "Published — read-only view"}
      />
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <button type="button" onClick={onSave} disabled={saving} className="border-2 border-foreground px-4 py-2 text-sm font-bold uppercase">
              Save
            </button>
            <button type="button" onClick={onPublish} className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background">
              Publish
            </button>
            <button type="button" onClick={onDelete} className="border-2 border-foreground px-4 py-2 text-sm uppercase">
              Delete
            </button>
          </>
        )}
        {!isDraft && <UnpublishRequestForm documentId={selectedId} />}
      </div>
    </div>
  );
}

function UnpublishRequestForm({ documentId }: { documentId: string }) {
  const [justification, setJustification] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const submit = async () => {
    try {
      await api.submitUnpublishRequest(documentId, justification);
      setStatus("Request submitted for admin review.");
    } catch (err) {
      setStatus(err instanceof ApiError || err instanceof NetworkError ? err.message : "Request failed.");
    }
  };

  return (
    <div className="w-full border-2 border-foreground p-3">
      <p className="mb-2 text-sm font-bold uppercase">Request unpublish</p>
      <textarea
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        rows={3}
        className="mb-2 w-full border-2 border-foreground bg-background p-2 text-sm"
      />
      <button type="button" onClick={submit} className="border-2 border-foreground px-3 py-1 text-sm font-bold uppercase">
        Submit
      </button>
      {status && <p className="mt-2 text-sm text-muted">{status}</p>}
    </div>
  );
}
