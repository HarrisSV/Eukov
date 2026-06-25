"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccessKeyForm } from "@/features/auth/AccessKeyForm";
import { AuthorReviewQueue } from "@/features/admin/AuthorReviewQueue";
import { SuperAdminPanel } from "@/features/admin/SuperAdminPanel";
import { api, formatGenreLabel, formatRoleLabel, formatUserFullName } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export function DashboardContent() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);

  const profileQuery = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: api.me,
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const displayUser = profileQuery.data ?? user;

  const preferencesQuery = useQuery({
    queryKey: ["preferences", user?.id],
    queryFn: () => api.getPreferences(user!.id),
    enabled: Boolean(user?.id),
  });

  const role = displayUser?.role ?? roles.Reader;

  useEffect(() => {
    if (profileQuery.data) {
      updateUser(profileQuery.data);
    }
  }, [profileQuery.data, updateUser]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="You"
        description={
          role === roles.SuperAdmin
            ? "Your profile, platform tools, security controls, and audit activity."
            : role === roles.Admin
              ? "Your profile, author reviews, and publishing activity."
              : "Your reading preferences, docket, and library access."
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        <Card title="Welcome">
          {displayUser ? (
            <>
              <p className="text-sm text-muted">Welcome back,</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {profileQuery.isLoading && !profileQuery.data
                  ? "…"
                  : displayUser.nickname || formatUserFullName(displayUser) || "Reader"}
              </p>
              {displayUser.nickname && formatUserFullName(displayUser) ? (
                <p className="mt-1 text-base font-medium text-muted">
                  {formatUserFullName(displayUser)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-foreground">Welcome to EUKOV</p>
          )}
          <p className="mt-3 text-sm text-muted">Role: {formatRoleLabel(role)}</p>
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
      </div>

      {role === roles.Reader && (
        <Card title="Apply for Author Status">
          <p className="mb-4 text-sm text-muted">
            Submit your author request from Settings, then track replies in Inbox.
          </p>
          <a
            href="/dashboard/settings"
            className="text-sm font-medium text-accent hover:underline"
          >
            Go to Settings →
          </a>
        </Card>
      )}

      {roles.hasAtLeast(role, roles.Admin) && <AuthorReviewQueue />}

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
