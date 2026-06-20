"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { DocketEditorPage } from "@/features/docket/DocketEditorPage";
import "@/features/docket/draft-editor.css";

export default function EditDocketEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AppShell hideSidebar compact>
      <AuthGuard>
        <DocketEditorPage documentId={id} />
      </AuthGuard>
    </AppShell>
  );
}
