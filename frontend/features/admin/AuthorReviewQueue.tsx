"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { api, type AuthorApplication } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

function AuthorRequestItem({ app }: { app: AuthorApplication }) {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const [reply, setReply] = useState("");
  const [includeAccessKey, setIncludeAccessKey] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const replyMutation = useMutation({
    mutationFn: () =>
      api.replyAuthorApplication(app.id, {
        message: reply,
        includeAccessKey,
      }),
    onSuccess: () => {
      setReply("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["author-applications"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: () => api.approveAuthorApplication(app.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["author-applications"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectAuthorApplication(app.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["author-applications"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const displayName =
    app.userNickname || app.userFullName || app.userEmail || app.userId;

  return (
    <li className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{displayName}</p>
          <p className="text-sm text-muted">{app.userEmail}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs uppercase">
          {app.status}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">
        {app.subject || "Author request"}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">
        {app.messageBody || app.experience}
      </p>
      {app.attachments && app.attachments.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {app.attachments.map((file) => (
            <li key={file.id}>
              <a
                href={api.downloadAuthorAttachment(file.id)}
                download={file.fileName}
                className="rounded border border-border px-2 py-1 text-xs hover:bg-surface"
                onClick={(e) => {
                  if (!token) return;
                  e.preventDefault();
                  fetch(api.downloadAuthorAttachment(file.id), {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                    .then((res) => res.blob())
                    .then((blob) => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = file.fileName;
                      a.click();
                      URL.revokeObjectURL(url);
                    });
                }}
              >
                {file.fileName}
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
        <label className="text-sm font-medium" htmlFor={`reply-${app.id}`}>
          Reply to reader
        </label>
        <textarea
          id={`reply-${app.id}`}
          rows={4}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Write your reply. Include an author access key so the reader can redeem it in Settings."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeAccessKey}
            onChange={(e) => setIncludeAccessKey(e.target.checked)}
          />
          Include Admin Access key in reply
        </label>
        <p className="text-xs text-muted">
          Replying does not grant author access. The reader must redeem the Admin Access
          key from their Inbox or Settings, unless you use Quick approve below.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => replyMutation.mutate()}
            disabled={replyMutation.isPending || reply.trim().length < 3}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
          >
            {replyMutation.isPending ? "Sending..." : "Send reply"}
          </button>
          <button
            type="button"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
          >
            Quick approve
          </button>
          <button
            type="button"
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}

export function AuthorReviewQueue() {
  const appsQuery = useQuery({
    queryKey: ["author-applications"],
    queryFn: async () => (await api.listAuthorApplications()).applications,
  });

  return (
    <Card title="Author Requests">
      {appsQuery.isLoading && (
        <p className="text-sm text-muted">Loading review queue...</p>
      )}
      {appsQuery.data?.length === 0 && !appsQuery.isLoading && (
        <p className="text-sm text-muted">No pending applications.</p>
      )}
      <ul className="flex flex-col gap-4">
        {appsQuery.data?.map((app) => (
          <AuthorRequestItem key={app.id} app={app} />
        ))}
      </ul>
    </Card>
  );
}
