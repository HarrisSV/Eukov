"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function PortalFooter() {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
  });

  const isHealthy = healthQuery.data?.status === "healthy";
  const statusLabel = healthQuery.isLoading
    ? "Checking..."
    : isHealthy
      ? "Healthy"
      : "Degraded";

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-background px-4 py-4 md:px-8">
      <div className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} EUKOV Infrastructure</p>
        <div className="flex gap-4">
          <span className="cursor-default">Privacy Policy</span>
          <span
            className="flex items-center gap-1.5 cursor-default"
            title={statusLabel}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                healthQuery.isLoading
                  ? "bg-muted"
                  : isHealthy
                    ? "bg-success"
                    : "bg-danger"
              }`}
              aria-hidden
            />
            API Status
          </span>
        </div>
      </div>
    </footer>
  );
}
