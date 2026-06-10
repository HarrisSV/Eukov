"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { AuthorApplicationForm } from "@/features/auth/AuthorApplicationForm";
import { AccessKeyForm } from "@/features/auth/AccessKeyForm";
import { AuthorReviewQueue } from "@/features/admin/AuthorReviewQueue";
import { SuperAdminPanel } from "@/features/admin/SuperAdminPanel";
import { api, formatGenreLabel, formatRoleLabel } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export function DashboardContent() {
  const user = useAuthStore((state) => state.user);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
  });

  const preferencesQuery = useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: () => api.getPreferences(user!.id),
    enabled: Boolean(user?.id),
  });

  const isHealthy = healthQuery.data?.status === "healthy";
  const role = user?.role ?? roles.Reader;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {role === roles.SuperAdmin
            ? "Super Admin Dashboard"
            : role === roles.Admin
              ? "Admin Dashboard"
              : "Reader Dashboard"}
        </h1>
        <p className="mt-2 text-muted">
          Phase 2 access layer — authentication, RBAC, and governance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        <Card title="Welcome">
          <p className="text-foreground">
            {user?.email ? `Welcome back, ${user.email}` : "Welcome to EUKOV"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Role: {formatRoleLabel(role)}
          </p>
        </Card>

        <Card title="Profile & Security">
          <p className="text-sm text-muted">
            Manage account security and session settings.
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
          >
            Open security settings →
          </Link>
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
              <p className="text-sm text-muted">No genre preferences saved yet.</p>
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
        </Card>
      </div>

      {role === roles.Reader && (
        <Card title="Apply for Author Status">
          <AuthorApplicationForm />
        </Card>
      )}

      {roles.hasAtLeast(role, roles.Admin) && (
        <AuthorReviewQueue />
      )}

      {role === roles.SuperAdmin && <SuperAdminPanel />}

      {roles.hasAtLeast(role, roles.Reader) && role !== roles.SuperAdmin && (
        <Card title="Admin Access Key">
          <p className="mb-4 text-sm text-muted">
            Redeem a single-use key from your Super Admin to become an Admin.
          </p>
          <AccessKeyForm />
        </Card>
      )}
    </div>
  );
}
