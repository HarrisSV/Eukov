"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AuthorRequestCard } from "@/features/author/AuthorRequestCard";
import { AccessKeyForm } from "@/features/auth/AccessKeyForm";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AppShell>
      <AuthGuard>
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold">Security Settings</h1>
          <Card title="Appearance">
            <p className="mb-4 text-sm text-muted">
              Switch between light and dark themes.
            </p>
            <ThemeToggle />
          </Card>
          {user?.role === roles.Reader && <AuthorRequestCard />}
          {user?.role === roles.Reader && (
            <Card title="Admin Access Key">
              <p className="mb-4 text-sm text-muted">
                When an admin replies to your author request with an access key, redeem it
                here to become an Author. You can also redeem directly from your{" "}
                <a href="/dashboard/inbox" className="font-medium text-accent hover:underline">
                  Inbox
                </a>
                .
              </p>
              <AccessKeyForm />
            </Card>
          )}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
