import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DocketWorkspace } from "@/features/docket/DocketWorkspace";
export default function DocketPage() {
  return (
    <AppShell>
      <AuthGuard>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0">
            <h1 className="text-2xl font-bold uppercase tracking-tight">My Docket</h1>
            <p className="text-sm text-muted">
              Universal personal workspace — subscriptions, reading, and author manuscripts.
            </p>
          </div>
          <DocketWorkspace />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
