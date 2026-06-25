import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryCatalog } from "@/features/library/LibraryCatalog";

export default function LibraryPage() {
  return (
    <AppShell>
      <AuthGuard>
        <div className="flex flex-col gap-8">
          <PageHeader
            eyebrow="Catalog"
            title="Global Library"
            description="Preview excerpts, follow authors, and issue books to your docket."
          />
          <LibraryCatalog />
        </div>
      </AuthGuard>
    </AppShell>
  );
}
