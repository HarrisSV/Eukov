import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DocketEditorPage } from "@/features/docket/DocketEditorPage";
import "@/features/docket/draft-editor.css";

export default function NewDocketEditorPage() {
  return (
    <AppShell hideSidebar compact>
      <AuthGuard>
        <DocketEditorPage />
      </AuthGuard>
    </AppShell>
  );
}
