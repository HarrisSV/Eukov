import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DashboardContent } from "@/features/dashboard/DashboardContent";

export default function DashboardPage() {
  return (
    <AppShell>
      <AuthGuard>
        <DashboardContent />
      </AuthGuard>
    </AppShell>
  );
}
