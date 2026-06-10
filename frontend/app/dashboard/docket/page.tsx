import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DocketWorkspace } from "@/features/docket/DocketWorkspace";
export default function DocketPage() {
  return (
    <AppShell>
      <AuthGuard>
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold uppercase tracking-tight">My Docket</h1>
          <p className="text-sm text-muted">
            Universal personal workspace — subscriptions, reading, and author manuscripts.
          </p>
          <DocketWorkspace />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
