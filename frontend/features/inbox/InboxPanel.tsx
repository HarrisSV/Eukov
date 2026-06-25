"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { AccessKeyForm } from "@/features/auth/AccessKeyForm";
import { api, type InboxMessage } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

const ACCESS_KEY_PATTERN = /EUKOV-[A-Za-z0-9_-]+/;

function formatMessageType(type: string): string {
  switch (type) {
    case "AUTHOR_REQUEST_ACK":
      return "Request sent";
    case "ADMIN_REPLY":
      return "Admin reply";
    case "AUTHOR_REQUEST":
      return "Author request";
    case "AUTHOR_PROMOTED":
      return "Author approved";
    case "BOOK_RELEASE":
      return "New release";
    case "SCRIPT_TAKEDOWN":
      return "Script takedown";
    default:
      return type.replaceAll("_", " ").toLowerCase();
  }
}

function extractAccessKey(body: string): string | undefined {
  return body.match(ACCESS_KEY_PATTERN)?.[0];
}

function formatAdminReplyBody(body: string, hasAccessKey: boolean): string {
  let text = body
    .replace(
      /\n\nYou have been approved as an Author\.[^\n]*/gi,
      "",
    )
    .replace(/Your (admin|author) access key:/gi, "Your Admin Access key:");

  if (hasAccessKey && !/redeem the admin access key/i.test(text)) {
    text = `${text.trim()}\n\nRedeem the Admin Access key to become an Author.`;
  }

  return text.trim();
}

function InboxItem({
  message,
  onRead,
}: {
  message: InboxMessage;
  onRead: (id: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const unread = !message.readAt;
  const accessKey = extractAccessKey(message.body);
  const hasAccessKey =
    Boolean(message.metadata?.includeAccessKey) || Boolean(accessKey);
  const showRedeem =
    message.messageType === "ADMIN_REPLY" &&
    hasAccessKey &&
    user?.role === roles.Reader;
  const displayBody =
    message.messageType === "ADMIN_REPLY"
      ? formatAdminReplyBody(message.body, hasAccessKey)
      : message.body;

  return (
    <article
      className={`rounded-lg border p-4 ${
        unread ? "border-accent bg-surface" : "border-border bg-background"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {formatMessageType(message.messageType)}
          </p>
          <h3 className="mt-1 font-medium text-foreground">{message.subject}</h3>
        </div>
        <time className="shrink-0 text-xs text-muted">
          {new Date(message.createdAt).toLocaleString()}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{displayBody}</p>

      {showRedeem && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="text-sm font-medium text-foreground">
            Redeem your Admin Access key
          </p>
          <p className="mt-1 text-xs text-muted">
            Enter the key from this message to become an Author.
          </p>
          <AccessKeyForm
            compact
            defaultAccessKey={accessKey}
            onSuccess={() => {
              if (unread) {
                onRead(message.id);
              }
            }}
          />
        </div>
      )}

      {unread && (
        <button
          type="button"
          onClick={() => onRead(message.id)}
          className="mt-3 text-sm font-medium text-accent hover:underline"
        >
          Mark as read
        </button>
      )}
    </article>
  );
}

export function InboxPanel() {
  const queryClient = useQueryClient();
  const inboxQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => (await api.getInbox()).messages,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => api.markInboxRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  return (
    <Card title="Inbox">
      {inboxQuery.isLoading && (
        <p className="text-sm text-muted">Loading messages...</p>
      )}
      {inboxQuery.isError && (
        <p className="text-sm text-danger">Could not load inbox.</p>
      )}
      {inboxQuery.data?.length === 0 && !inboxQuery.isLoading && (
        <p className="text-sm text-muted">No messages yet.</p>
      )}
      <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {inboxQuery.data?.map((message) => (
          <InboxItem
            key={message.id}
            message={message}
            onRead={(id) => readMutation.mutate(id)}
          />
        ))}
      </div>
    </Card>
  );
}
