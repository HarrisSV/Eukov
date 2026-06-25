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
    <footer className="mt-auto shrink-0 border-t border-border/70 bg-background/60 px-4 py-4 backdrop-blur-sm md:px-8">
      <div className="flex flex-col gap-2 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium tracking-wide">
          © {new Date().getFullYear()} EUKOV Infrastructure
        </p>
        <div className="flex gap-5">
          <span className="cursor-default transition-colors hover:text-foreground">
            Privacy Policy
          </span>
          <span
            className="flex items-center gap-1.5 cursor-default transition-colors hover:text-foreground"
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
