import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { SuperAdminPanel } from "@/features/admin/SuperAdminPanel";
import { roles } from "@/lib/roles";

export default function SuperAdminDashboardPage() {
  return (
    <AppShell>
      <AuthGuard minRole={roles.SuperAdmin}>
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold">Super Admin</h1>
          <SuperAdminPanel />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
