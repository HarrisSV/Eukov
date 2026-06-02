"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { api, formatGenreLabel } from "@/services/api";
import { useUserStore } from "@/store/userStore";

export function DashboardContent() {
  const userId = useUserStore((state) => state.userId);
  const email = useUserStore((state) => state.email);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
  });

  const preferencesQuery = useQuery({
    queryKey: ["preferences", userId],
    queryFn: () => api.getPreferences(userId!),
    enabled: Boolean(userId),
  });

  const isHealthy = healthQuery.data?.status === "healthy";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reader Dashboard</h1>
        <p className="mt-2 text-muted">
          Your EUKOV foundation workspace is ready.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Welcome">
          <p className="text-foreground">
            {email ? `Welcome back, ${email}` : "Welcome to EUKOV"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Role: Reader · Phase 1 foundation setup complete
          </p>
        </Card>

        <Card title="Registration Metrics">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Account status</dt>
              <dd className="font-medium text-success">Active</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">User ID</dt>
              <dd className="truncate font-mono text-xs">{userId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Onboarding</dt>
              <dd className="font-medium text-foreground">
                {(preferencesQuery.data?.genres.length ?? 0) > 0
                  ? "Complete"
                  : "Pending"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card title="Questionnaire Summary">
          {preferencesQuery.isLoading && (
            <p className="text-sm text-muted">Loading preferences...</p>
          )}
          {preferencesQuery.data?.genres.length ? (
            <ul className="flex flex-wrap gap-2">
              {preferencesQuery.data.genres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-full border border-border bg-background px-3 py-1 text-sm"
                >
                  {formatGenreLabel(genre)}
                </li>
              ))}
            </ul>
          ) : (
            !preferencesQuery.isLoading && (
              <p className="text-sm text-muted">
                No genre preferences saved yet.
              </p>
            )
          )}
        </Card>

        <Card title="API Status">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-3 w-3 rounded-full ${
                isHealthy ? "bg-success" : "bg-danger"
              }`}
              aria-hidden="true"
            />
            <span className="font-medium">
              {healthQuery.isLoading
                ? "Checking..."
                : isHealthy
                  ? "Healthy"
                  : "Degraded"}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            Backend health endpoint: /api/v1/health
          </p>
        </Card>
      </div>
    </div>
  );
}
