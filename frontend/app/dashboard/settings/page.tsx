"use client";

import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
          {user && user.role !== roles.SuperAdmin && (
            <Card title="Admin Access Key">
              <AccessKeyForm />
            </Card>
          )}
        </div>
      </AuthGuard>
    </AppShell>
  );
}
