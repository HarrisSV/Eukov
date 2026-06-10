import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { LibraryCatalog } from "@/features/library/LibraryCatalog";

export default function LibraryPage() {
  return (
    <AppShell>
      <AuthGuard>
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-bold">Global Library</h1>
          <LibraryCatalog />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
