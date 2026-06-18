import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { InboxPanel } from "@/features/inbox/InboxPanel";

export default function InboxPage() {
  return (
    <AppShell>
      <AuthGuard>
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold">Inbox</h1>
          <p className="text-sm text-muted">
            Author requests, admin replies, and new book releases appear here.
          </p>
          <InboxPanel />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
