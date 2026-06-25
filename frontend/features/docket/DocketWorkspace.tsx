"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { api } from "@/services/api";
import type { DocumentSummary } from "@/services/api";
import { resolveReadingResumePage } from "@/lib/reading-bookmark";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export function DocketWorkspace() {
  const user = useAuthStore((s) => s.user);
  const isAuthor = user ? roles.hasAtLeast(user.role, roles.Author) : false;

  const workspaceQuery = useQuery({
    queryKey: ["docket-workspace", user?.id, user?.role],
    queryFn: api.getDocketWorkspace,
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: false,
  });

  const ws = workspaceQuery.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isAuthor ? (
        <DocketShelf ws={ws} />
      ) : (
        <ReaderDocketPanel ws={ws} />
      )}
    </div>
  );
}

function DocketShelf({
  ws,
}: {
  ws?: Awaited<ReturnType<typeof api.getDocketWorkspace>>;
}) {
  return (
    <div className="wireframe-panel flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-foreground bg-background">
      <ShelfStrip label="Subscribed">
        {ws?.subscribedItems.length ? (
          <p className="text-xs text-muted">Subscriptions appear here in Phase 4.</p>
        ) : (
          <p className="whitespace-nowrap text-xs text-muted">No subscriptions yet.</p>
        )}
      </ShelfStrip>

      <ShelfStrip
        label="Drafts"
        action={
          <Link
            href="/dashboard/docket/editor"
            className="border border-foreground px-2 py-0.5 text-xs font-bold uppercase"
          >
            My Editor
          </Link>
        }
      >
        <DocStrip items={ws?.drafts ?? []} showNewDraft />
      </ShelfStrip>

      <ShelfStrip label="Published">
        <DocStrip items={ws?.published ?? []} readOnly />
      </ShelfStrip>
    </div>
  );
}

function ShelfStrip({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-foreground last:border-b-0">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide">{label}</h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-4 py-3">
        {children}
      </div>
    </section>
  );
}

function DocStrip({
  items,
  showNewDraft = false,
  readOnly = false,
}: {
  items: DocumentSummary[];
  showNewDraft?: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();

  if (items.length === 0 && !showNewDraft) {
    return <p className="whitespace-nowrap text-xs text-muted">None yet.</p>;
  }

  return (
    <ul className="flex w-max min-w-full gap-2">
      {items.map((doc) => (
        <li key={doc.id} className="shrink-0">
          {readOnly ? (
            <PublishedDocCard doc={doc} />
          ) : (
            <button
              type="button"
              onClick={() => router.push(`/dashboard/docket/editor/${doc.id}`)}
              className="flex h-full min-w-[9rem] max-w-[12rem] flex-col border-2 border-foreground px-3 py-2 text-left text-sm hover:bg-surface"
            >
              <span className="line-clamp-2">{doc.title}</span>
              <span className="mt-1 text-xs uppercase text-muted">{doc.status}</span>
            </button>
          )}
        </li>
      ))}
      {showNewDraft && (
        <li className="flex shrink-0 self-stretch">
          <Link
            href="/dashboard/docket/editor"
            aria-label="New draft"
            title="New draft"
            className="flex min-h-[3.25rem] w-[3.25rem] items-center justify-center self-stretch border-2 border-foreground text-xl font-bold leading-none hover:bg-surface"
          >
            +
          </Link>
        </li>
      )}
    </ul>
  );
}

function PublishedDocCard({ doc }: { doc: DocumentSummary }) {
  const [copyVisible, setCopyVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(doc.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex min-w-[11rem] max-w-[14rem] cursor-default flex-col border-2 border-foreground px-3 py-2 text-sm">
      <span className="line-clamp-2">{doc.title}</span>
      <span className="mt-1 text-xs uppercase text-muted">{doc.status}</span>
      <div className="mt-2 flex items-center gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={() => setCopyVisible((visible) => !visible)}
          className="min-w-0 flex-1 truncate text-left font-mono text-[10px] leading-snug text-muted"
          title={doc.id}
        >
          {doc.id}
        </button>
        {copyVisible ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="shrink-0 border border-foreground px-1.5 py-0.5 text-[10px] font-medium uppercase"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ReaderDocketPanel({ ws }: { ws?: Awaited<ReturnType<typeof api.getDocketWorkspace>> }) {
  const booksQuery = useQuery({
    queryKey: ["docket-books"],
    queryFn: async () => (await api.getDocketBooks()).books,
  });

  return (
    <div className="wireframe-panel flex flex-col gap-6 border-2 border-foreground p-4 md:p-6">
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
                href={`/dashboard/read/${book.documentId}?from=docket&page=${resolveReadingResumePage(book.documentId, null, book.currentPage)}`}
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
