"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { api, formatRoleLabel } from "@/services/api";

export function AuthorActivityPanel() {
  const query = useQuery({
    queryKey: ["admin-author-activity"],
    queryFn: api.getAdminAuthorActivity,
  });

  return (
    <Card title="Author publishing activity">
      <p className="mb-4 text-sm text-muted">
        Metrics and events only — draft content is not visible to admins.
      </p>
      {query.isLoading && <p className="text-sm text-muted">Loading...</p>}
      <div className="overflow-x-auto border-2 border-foreground">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-foreground bg-surface">
              <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">Author</th>
              <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">Role</th>
              <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">Drafts</th>
              <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">Published</th>
              <th className="px-3 py-2 text-left font-bold uppercase">Recent events</th>
            </tr>
          </thead>
          <tbody>
            {query.data?.authors.map((author) => (
              <tr key={author.userId} className="border-b border-foreground">
                <td className="border-r border-foreground px-3 py-2">{author.email}</td>
                <td className="border-r border-foreground px-3 py-2">{formatRoleLabel(author.role)}</td>
                <td className="border-r border-foreground px-3 py-2 text-center">{author.draftCount}</td>
                <td className="border-r border-foreground px-3 py-2 text-center">{author.publishedCount}</td>
                <td className="px-3 py-2">
                  <ul className="space-y-1 text-xs">
                    {author.recentEvents.slice(0, 5).map((ev) => (
                      <li key={ev.id}>
                        <span className="font-medium">{ev.eventType}</span>
                        {ev.documentId && (
                          <span className="text-muted"> · {ev.documentId.slice(0, 8)}…</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
