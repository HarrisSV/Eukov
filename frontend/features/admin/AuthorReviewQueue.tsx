"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { api } from "@/services/api";

export function AuthorReviewQueue() {
  const queryClient = useQueryClient();
  const appsQuery = useQuery({
    queryKey: ["author-applications"],
    queryFn: api.listAuthorApplications,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveAuthorApplication(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["author-applications"] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectAuthorApplication(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["author-applications"] }),
  });

  return (
    <Card title="Author Requests">
      {appsQuery.isLoading && (
        <p className="text-sm text-muted">Loading review queue...</p>
      )}
      {appsQuery.data?.applications.length === 0 && !appsQuery.isLoading && (
        <p className="text-sm text-muted">No pending applications.</p>
      )}
      <ul className="flex flex-col gap-4">
        {appsQuery.data?.applications.map((app) => (
          <li
            key={app.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <p className="text-sm font-medium text-foreground">
              Applicant: {app.userId}
            </p>
            <p className="mt-2 text-sm text-muted">{app.qualifications}</p>
            <p className="mt-1 text-sm text-muted">{app.experience}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => approveMutation.mutate(app.id)}
                disabled={approveMutation.isPending}
                className="rounded-lg bg-success px-3 py-1.5 text-sm font-medium text-background hover:opacity-90"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate(app.id)}
                disabled={rejectMutation.isPending}
                className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
