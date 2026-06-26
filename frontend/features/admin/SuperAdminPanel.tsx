"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { api, ApiError, NetworkError } from "@/services/api";
import { formatRelativeTime } from "@/lib/relative-time";

const AUDIT_PREVIEW_COUNT = 4;

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function AuditLogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function auditLogSummary(action: string): string {
  switch (action) {
    case "DOCUMENT_PUBLISHED":
      return "A document was published to the public library.";
    case "DOCUMENT_TAKEDOWN":
      return "A published script was taken down by its author.";
    case "DOCUMENT_SAVED":
      return "Draft content was saved.";
    case "UNPUBLISH_APPROVED":
      return "An unpublish request was approved.";
    default:
      return "Platform activity recorded in the audit trail.";
  }
}

export function SuperAdminPanel() {
  const queryClient = useQueryClient();
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);
  const [takedownDocId, setTakedownDocId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [takedownResult, setTakedownResult] = useState<string | null>(null);
  const [auditExpanded, setAuditExpanded] = useState(false);

  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: api.listAuditLogs,
  });

  const generateMutation = useMutation({
    mutationFn: api.generateAccessKey,
    onSuccess: (data) => setGeneratedKey(data.accessKey),
  });

  const takedownMutation = useMutation({
    mutationFn: (documentId: string) => api.takedownPublishedScript(documentId),
    onSuccess: (data) => {
      setConfirmOpen(false);
      setTakedownDocId("");
      setTakedownResult(
        `Takedown complete for "${data.document.title}". The script is back in drafts.`,
      );
      void queryClient.invalidateQueries({ queryKey: ["docket-workspace"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
      auditQuery.refetch();
    },
    onError: (err: Error) => {
      setConfirmOpen(false);
      if (err instanceof ApiError || err instanceof NetworkError) {
        setTakedownResult(err.message);
      } else {
        setTakedownResult("Takedown failed.");
      }
    },
  });

  function openTakedownConfirm() {
    const trimmed = takedownDocId.trim();
    if (!trimmed) {
      return;
    }
    setTakedownResult(null);
    setConfirmOpen(true);
  }

  function confirmTakedown() {
    takedownMutation.mutate(takedownDocId.trim());
  }

  const logs = auditQuery.data?.logs ?? [];
  const visibleLogs = auditExpanded ? logs : logs.slice(0, AUDIT_PREVIEW_COUNT);
  const hasMoreLogs = logs.length > AUDIT_PREVIEW_COUNT;

  function openFullAuditHistory() {
    setAuditExpanded(true);
    void auditQuery.refetch();
  }

  async function copyGeneratedKey() {
    if (!generatedKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedKey);
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      setKeyCopied(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Generate Access Key"
          description="Single-use keys promote trusted users to Admin. Share securely. Use this for temporary privilege escalation."
          className="h-full"
        >
          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {generateMutation.isPending ? "Generating..." : "Generate Key"}
          </button>
          {generatedKey ? (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-3">
              <p className="min-w-0 flex-1 break-all font-mono text-xs text-foreground">
                {generatedKey}
              </p>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => void copyGeneratedKey()}
                  aria-label={keyCopied ? "Access key copied" : "Copy access key"}
                  title={keyCopied ? "Copied" : "Copy to clipboard"}
                  className={`rounded-lg p-2 transition-colors ${
                    keyCopied
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:bg-background hover:text-foreground"
                  }`}
                >
                  {keyCopied ? <CheckIcon /> : <CopyIcon />}
                </button>
                {keyCopied ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-accent">
                    Copied
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>

        <Card
          title="Takedown Published Script"
          description="Enter a published script UUID to remove it from the library. Only the author of that script can perform a takedown."
          className="h-full"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={takedownDocId}
              onChange={(e) => setTakedownDocId(e.target.value)}
              placeholder="Document UUID"
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted"
            />
            <button
              type="button"
              onClick={openTakedownConfirm}
              disabled={!takedownDocId.trim() || takedownMutation.isPending}
              className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50"
            >
              Takedown
            </button>
          </div>
          {takedownResult ? (
            <p className="mt-4 text-sm text-foreground">{takedownResult}</p>
          ) : null}
        </Card>

        <Card
          title="Audit Logs"
          className="lg:col-span-2"
          headerAction={
            hasMoreLogs || auditExpanded ? (
              <button
                type="button"
                className="text-sm font-medium text-accent hover:underline"
                onClick={() => {
                  if (auditExpanded) {
                    setAuditExpanded(false);
                    return;
                  }
                  openFullAuditHistory();
                }}
              >
                {auditExpanded ? "Show less" : "View Full History"}
              </button>
            ) : null
          }
        >
          {auditQuery.isLoading ? (
            <p className="text-sm text-muted">Loading audit trail...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted">No audit events yet.</p>
          ) : (
            <>
              <ul className="divide-y divide-border">
                {visibleLogs.map((log) => (
                  <li key={log.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <AuditLogIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          {log.action}
                          <span className="font-normal text-muted"> · {log.entityType}</span>
                        </p>
                        <time className="shrink-0 text-xs text-muted">
                          {formatRelativeTime(log.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-muted">{auditLogSummary(log.action)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {!auditExpanded && hasMoreLogs ? (
                <div className="mt-2 flex justify-center border-t border-border pt-3">
                  <button
                    type="button"
                    onClick={openFullAuditHistory}
                    aria-label={`Show ${logs.length - AUDIT_PREVIEW_COUNT} more audit logs`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-background hover:text-foreground"
                  >
                    <ChevronDownIcon />
                  </button>
                </div>
              ) : null}
            </>
          )}
        </Card>
      </div>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="takedown-confirm-title"
        >
          <div className="portal-card w-full max-w-md rounded-2xl border border-border bg-background p-6">
            <h2 id="takedown-confirm-title" className="text-lg font-bold text-foreground">
              Confirm takedown
            </h2>
            <p className="mt-3 text-sm text-muted">
              Do you really want to takedown this published script?
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{takedownDocId.trim()}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={takedownMutation.isPending}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmTakedown}
                disabled={takedownMutation.isPending}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
              >
                {takedownMutation.isPending ? "Taking down..." : "Takedown"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
