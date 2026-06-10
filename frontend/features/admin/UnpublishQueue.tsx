"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";

export function UnpublishQueue() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["unpublish-requests"],
    queryFn: api.listUnpublishRequests,
  });

  const approve = useMutation({
    mutationFn: api.approveUnpublishRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["unpublish-requests"] }),
  });

  const reject = useMutation({
    mutationFn: api.rejectUnpublishRequest,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["unpublish-requests"] }),
  });

  return (
    <div className="overflow-x-auto border-2 border-foreground">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-foreground bg-surface">
            <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">
              Document
            </th>
            <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">
              Author
            </th>
            <th className="border-r border-foreground px-3 py-2 text-left font-bold uppercase">
              Justification
            </th>
            <th className="px-3 py-2 text-left font-bold uppercase">Actions</th>
          </tr>
        </thead>
        <tbody>
          {query.data?.requests.map((req) => (
            <tr key={req.id} className="border-b border-foreground">
              <td className="border-r border-foreground px-3 py-2 font-mono text-xs">
                {req.documentId}
              </td>
              <td className="border-r border-foreground px-3 py-2 font-mono text-xs">
                {req.authorId}
              </td>
              <td className="border-r border-foreground px-3 py-2">
                {req.justification}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => approve.mutate(req.id)}
                    className="border-2 border-foreground bg-foreground px-2 py-1 text-xs font-bold uppercase text-background"
                  >
                    Approve take down
                  </button>
                  <button
                    type="button"
                    onClick={() => reject.mutate(req.id)}
                    className="border-2 border-foreground px-2 py-1 text-xs font-bold uppercase"
                  >
                    Deny request
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {query.data?.requests.length === 0 && !query.isLoading && (
        <p className="p-4 text-sm text-muted">No pending unpublish requests.</p>
      )}
    </div>
  );
}
