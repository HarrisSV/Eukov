"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { resolveReadingResumePage } from "@/lib/reading-bookmark";
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
  const pageParam = searchParams.get("page");
  const parsedPage = pageParam ? Number(pageParam) : null;
  const from = searchParams.get("from");
  const initialPage = resolveReadingResumePage(documentId, parsedPage, 1);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      <Breadcrumbs items={readBreadcrumbs(from)} />
      <BookReader documentId={documentId} initialPage={initialPage} from={from === "docket" ? "docket" : "library"} />
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
