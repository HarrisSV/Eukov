"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { api } from "@/services/api";

export function SuperAdminPanel() {
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [reviewDocId, setReviewDocId] = useState("");
  const [reviewResult, setReviewResult] = useState<string | null>(null);
  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: api.listAuditLogs,
  });

  const generateMutation = useMutation({
    mutationFn: api.generateAccessKey,
    onSuccess: (data) => setGeneratedKey(data.accessKey),
  });

  const reviewMutation = useMutation({
    mutationFn: (documentId: string) => api.superAdminReviewDraft(documentId),
    onSuccess: (data) => {
      setReviewResult(
        `Reviewed draft "${data.document.title}" (${data.document.content?.length ?? 0} chars). Audit event recorded.`,
      );
      auditQuery.refetch();
    },
    onError: (err: Error) => setReviewResult(err.message),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Generate Access Key">
        <p className="mb-4 text-sm text-muted">
          Single-use keys promote trusted users to Admin. Share securely.
        </p>
        <button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {generateMutation.isPending ? "Generating..." : "Generate Key"}
        </button>
        {generatedKey && (
          <p className="mt-4 break-all rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground">
            {generatedKey}
          </p>
        )}
      </Card>

      <Card title="Emergency Draft Review">
        <p className="mb-4 text-sm text-muted">
          Load private draft content for moderation. Every review generates an
          ADMIN_REVIEWED_DRAFT audit event.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={reviewDocId}
            onChange={(e) => setReviewDocId(e.target.value)}
            placeholder="Document UUID"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => {
              setReviewResult(null);
              reviewMutation.mutate(reviewDocId.trim());
            }}
            disabled={!reviewDocId.trim() || reviewMutation.isPending}
            className="rounded-lg bg-warning px-4 py-2 text-sm font-medium text-foreground hover:opacity-90 disabled:opacity-50"
          >
            {reviewMutation.isPending ? "Loading..." : "Review Draft"}
          </button>
        </div>
        {reviewResult && (
          <p className="mt-4 text-sm text-foreground">{reviewResult}</p>
        )}
      </Card>

      <Card title="Audit Logs">
        {auditQuery.isLoading && (
          <p className="text-sm text-muted">Loading audit trail...</p>
        )}
        <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
          {auditQuery.data?.logs.map((log) => (
            <li
              key={log.id}
              className="rounded border border-border bg-background px-3 py-2"
            >
              <span className="font-medium text-foreground">{log.action}</span>
              <span className="text-muted"> · {log.entityType}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
