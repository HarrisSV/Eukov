"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { api, ApiError, NetworkError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export function AuthorRequestCard() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("Author access request");
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mineQuery = useQuery({
    queryKey: ["author-application-mine"],
    queryFn: async () => {
      try {
        return (await api.getMyAuthorApplication()).application;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: user?.role === roles.Reader,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.submitAuthorRequest({ subject, message, attachments }),
    onSuccess: () => {
      setOpen(false);
      setMessage("");
      setAttachments([]);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["author-application-mine"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!user || user.role !== roles.Reader) {
    return null;
  }

  const pending =
    mineQuery.data?.status === "PENDING" || mineQuery.data?.status === "REPLIED";

  return (
    <Card title="Become an Author">
      <p className="text-sm text-muted">
        Want to write and publish your own scripts? Request to become an author.
        Fill up the details below and attach samples of your previous work.
      </p>

      {mineQuery.data?.status === "REPLIED" && (
        <p className="mt-3 rounded-lg border border-accent bg-surface px-3 py-2 text-sm text-foreground">
          An admin replied to your request. Open your{" "}
          <a href="/dashboard/inbox" className="font-medium text-accent hover:underline">
            Inbox
          </a>{" "}
          and redeem the Admin Access key to become an Author.
        </p>
      )}

      {mineQuery.data?.status === "PENDING" && (
        <p className="mt-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground">
          Your request was sent. Please wait for an admin to reply. Check your{" "}
          <a href="/dashboard/inbox" className="font-medium text-accent hover:underline">
            Inbox
          </a>{" "}
          for updates.
        </p>
      )}

      {mineQuery.data?.adminReply && (
        <div className="mt-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
          <p className="font-medium text-foreground">Admin reply</p>
          <p className="mt-1 whitespace-pre-wrap text-muted">
            {mineQuery.data.adminReply
              .replace(
                /\n\nYou have been approved as an Author\.[^\n]*/gi,
                "",
              )
              .replace(/Your (admin|author) access key:/gi, "Your Admin Access key:")
              .trim()}
          </p>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={pending}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Request pending" : "Request to an admin"}
        </button>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            submitMutation.mutate();
          }}
        >
          <div>
            <label htmlFor="author-subject" className="mb-1 block text-sm font-medium">
              Subject
            </label>
            <input
              id="author-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="author-message" className="mb-1 block text-sm font-medium">
              Message
            </label>
            <textarea
              id="author-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell admins about your writing background, genres, and why you want to publish on EUKOV..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setAttachments((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-surface"
            >
              + Add attachment
            </button>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {attachments.map((file) => (
                  <li key={`${file.name}-${file.size}`}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitMutation.isPending || message.trim().length < 10}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
            >
              {submitMutation.isPending ? "Sending..." : "Send request"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
