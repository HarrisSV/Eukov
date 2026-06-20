"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BookReader } from "@/features/reader/BookReader";

function readBreadcrumbs(from: string | null) {
  if (from === "docket") {
    return [
      { label: "Docket", href: "/dashboard/docket" },
      { label: "View" },
    ];
  }

  return [
    { label: "Library", href: "/dashboard/library" },
    { label: "View" },
  ];
}

function ReadContent({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");
  const from = searchParams.get("from");

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <Breadcrumbs items={readBreadcrumbs(from)} />
      <BookReader documentId={documentId} initialPage={page > 0 ? page : 1} />
    </div>
  );
}

export default function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AppShell hideSidebar compact>
      <AuthGuard>
        <Suspense fallback={<p className="text-sm text-muted">Loading reader...</p>}>
          <ReadContent documentId={id} />
        </Suspense>
      </AuthGuard>
    </AppShell>
  );
}
