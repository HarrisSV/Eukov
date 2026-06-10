import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AuthorReviewQueue } from "@/features/admin/AuthorReviewQueue";
import { UnpublishQueue } from "@/features/admin/UnpublishQueue";
import { AuthorActivityPanel } from "@/features/admin/AuthorActivityPanel";
import { roles } from "@/lib/roles";

export default function AdminDashboardPage() {
  return (
    <AppShell>
      <AuthGuard minRole={roles.Admin}>
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold">Author Review Queue</h1>
          <AuthorActivityPanel />
          <AuthorReviewQueue />
          <h2 className="text-2xl font-bold">Unpublish moderation</h2>
          <UnpublishQueue />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
