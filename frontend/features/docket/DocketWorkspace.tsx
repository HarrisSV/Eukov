"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
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

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      draftTitle,
      draftContent,
    }: {
      id: string;
      draftTitle: string;
      draftContent: string;
    }) => api.updateDocument(id, draftTitle, draftContent),
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

  const ws = workspaceQuery.data;

  const selectDoc = (doc: DocumentSummary) => {
    setSelectedId(doc.id);
    setMessage(null);
    setError(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {isAuthor && (
        <DocketShelf
          ws={ws}
          selectedId={selectedId}
          onSelect={selectDoc}
          onNew={() => {
            setSelectedId(null);
            setTitle("New draft");
            setContent("");
          }}
        />
      )}

      <div className="wireframe-panel flex min-h-0 flex-1 flex-col border-2 border-foreground">
        <section className="flex min-h-0 flex-1 flex-col bg-background p-3 md:p-4">
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
            <SelectedDraftEditor
              key={selectedId}
              documentId={selectedId}
              onSave={(draftTitle, draftContent) =>
                saveMutation.mutate({
                  id: selectedId,
                  draftTitle,
                  draftContent,
                })
              }
              onPublish={(draftTitle, draftContent) => {
                setTitle(draftTitle);
                setContent(draftContent);
                setShowPublish(true);
              }}
              onDelete={async () => {
                await api.deleteDocument(selectedId);
                setSelectedId(null);
                queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
              }}
              saving={saveMutation.isPending}
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

function DocketShelf({
  ws,
  selectedId,
  onSelect,
  onNew,
}: {
  ws?: Awaited<ReturnType<typeof api.getDocketWorkspace>>;
  selectedId: string | null;
  onSelect: (d: DocumentSummary) => void;
  onNew: () => void;
}) {
  return (
    <div className="shrink-0 border-2 border-foreground bg-surface">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch gap-4 p-3">
          <ShelfSection label="Subscribed">
            {ws?.subscribedItems.length ? (
              <p className="text-xs text-muted">Subscriptions appear here in Phase 4.</p>
            ) : (
              <p className="whitespace-nowrap text-xs text-muted">No subscriptions yet.</p>
            )}
          </ShelfSection>

          <ShelfDivider />

          <ShelfSection
            label="Drafts"
            action={
              <button
                type="button"
                onClick={onNew}
                className="border border-foreground px-2 py-0.5 text-xs font-bold uppercase"
              >
                New
              </button>
            }
          >
            <DocStrip items={ws?.drafts ?? []} selectedId={selectedId} onSelect={onSelect} />
          </ShelfSection>

          <ShelfDivider />

          <ShelfSection label="Published">
            <DocStrip items={ws?.published ?? []} selectedId={selectedId} onSelect={onSelect} />
          </ShelfSection>
        </div>
      </div>
    </div>
  );
}

function ShelfDivider() {
  return <div className="w-px shrink-0 self-stretch bg-border" aria-hidden />;
}

function ShelfSection({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-[10rem] flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="whitespace-nowrap text-xs font-bold uppercase tracking-wide">{label}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DocStrip({
  items,
  selectedId,
  onSelect,
}: {
  items: DocumentSummary[];
  selectedId: string | null;
  onSelect: (d: DocumentSummary) => void;
}) {
  if (items.length === 0) {
    return <p className="whitespace-nowrap text-xs text-muted">None yet.</p>;
  }

  return (
    <ul className="flex gap-2">
      {items.map((doc) => (
        <li key={doc.id} className="shrink-0">
          <button
            type="button"
            onClick={() => onSelect(doc)}
            className={`flex h-full min-w-[9rem] max-w-[12rem] flex-col border-2 border-foreground px-3 py-2 text-left text-sm hover:bg-background ${
              selectedId === doc.id ? "bg-background font-bold" : ""
            }`}
          >
            <span className="line-clamp-2">{doc.title}</span>
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
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

function SelectedDraftEditor({
  documentId,
  onSave,
  onPublish,
  onDelete,
  saving,
}: {
  documentId: string;
  onSave: (title: string, content: string) => void;
  onPublish: (title: string, content: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const docQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => api.getDocument(documentId),
    refetchOnWindowFocus: false,
  });

  if (docQuery.isLoading) {
    return <p className="text-sm text-muted">Loading draft...</p>;
  }

  const document = docQuery.data?.document;
  if (!document) {
    return <p className="text-sm text-danger">Could not load this draft.</p>;
  }

  return (
    <LoadedDraftEditor
      key={documentId}
      document={document}
      onSave={onSave}
      onPublish={onPublish}
      onDelete={onDelete}
      saving={saving}
    />
  );
}

function LoadedDraftEditor({
  document,
  onSave,
  onPublish,
  onDelete,
  saving,
}: {
  document: { id: string; title: string; content?: string; status: string };
  onSave: (title: string, content: string) => void;
  onPublish: (title: string, content: string) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content ?? "");
  const isDraft = document.status === "DRAFT";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={!isDraft}
        className="border-2 border-foreground bg-background px-3 py-2 font-bold disabled:opacity-70"
      />
      <DraftEditor
        content={content}
        onChange={setContent}
        disabled={!isDraft}
        placeholder={isDraft ? "Write or import your manuscript..." : "Published — read-only view"}
      />
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <button
              type="button"
              onClick={() => onSave(title, content)}
              disabled={saving}
              className="border-2 border-foreground px-4 py-2 text-sm font-bold uppercase"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => onPublish(title, content)}
              className="border-2 border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase text-background"
            >
              Publish
            </button>
            <button type="button" onClick={onDelete} className="border-2 border-foreground px-4 py-2 text-sm uppercase">
              Delete
            </button>
          </>
        )}
        {!isDraft && <UnpublishRequestForm documentId={document.id} />}
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
