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

function QuickLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-xl border border-border/70 bg-background p-4 transition-all hover:border-accent-warm/35 hover:bg-accent-soft/50"
    >
      <span className="font-medium text-foreground group-hover:text-accent-warm">{label}</span>
      <span className="text-sm text-muted">{description}</span>
    </Link>
  );
}

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
  const displayName =
    profileQuery.isLoading && !profileQuery.data
      ? "…"
      : displayUser?.nickname || formatUserFullName(displayUser!) || "Reader";

  useEffect(() => {
    if (profileQuery.data) {
      updateUser(profileQuery.data);
    }
  }, [profileQuery.data, updateUser]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Your workspace"
        title="You"
        description={
          role === roles.SuperAdmin
            ? "Your profile, platform tools, security controls, and audit activity."
            : role === roles.Admin
              ? "Your profile, author reviews, and publishing activity."
              : "Your reading preferences, docket, and library access."
        }
      />

      <Card title={`Welcome back, ${displayName}`} variant="hero" className="overflow-hidden">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            {displayUser?.nickname && formatUserFullName(displayUser) ? (
              <p className="text-sm text-muted">{formatUserFullName(displayUser)}</p>
            ) : null}
            <p className="mt-2 font-serif text-2xl text-foreground md:text-3xl">
              {role === roles.SuperAdmin
                ? "Platform command center"
                : roles.hasAtLeast(role, roles.Author)
                  ? "Write, publish, and grow your readership"
                  : "Discover your next great read"}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/70 px-3 py-1 text-sm text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-warm" aria-hidden />
              Role: {formatRoleLabel(role)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <QuickLink href="/dashboard/library" label="Library" description="Browse catalog" />
            <QuickLink href="/dashboard/docket" label="Docket" description="Your workspace" />
            <QuickLink href="/dashboard/inbox" label="Inbox" description="Messages" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card title="Profile & Security" description="Account settings and session controls.">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-medium text-accent-warm transition-colors hover:text-accent-warm-hover"
          >
            Open security settings
            <span aria-hidden>→</span>
          </Link>
        </Card>

        <Card title="Questionnaire Summary" description="Genres that shape your recommendations.">
          {preferencesQuery.isLoading && (
            <p className="text-sm text-muted">Loading preferences...</p>
          )}
          {preferencesQuery.data?.genres.length ? (
            <ul className="flex flex-wrap gap-2">
              {preferencesQuery.data.genres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-full border border-border/80 bg-surface px-3 py-1 text-sm text-foreground"
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
          <Link
            href="/dashboard/settings"
            className="text-sm font-medium text-accent-warm hover:text-accent-warm-hover"
          >
            Go to Settings →
          </Link>
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
