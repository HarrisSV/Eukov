import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnpublishQueue } from "@/features/admin/UnpublishQueue";
import { AuthorActivityPanel } from "@/features/admin/AuthorActivityPanel";
import { roles } from "@/lib/roles";

export default function AdminDashboardPage() {
  return (
    <AppShell>
      <AuthGuard minRole={roles.Admin}>
        <div className="flex flex-col gap-6">
          <PageHeader
            title="Review Queue"
            description="Monitor author activity and moderate unpublish requests."
          />
          <AuthorActivityPanel />
          <h2 className="text-2xl font-bold">Unpublish moderation</h2>
          <UnpublishQueue />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
