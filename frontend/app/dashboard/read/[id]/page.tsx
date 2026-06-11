"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { BookReader } from "@/features/reader/BookReader";

function ReadContent({ documentId }: { documentId: string }) {
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1");

  return <BookReader documentId={documentId} initialPage={page > 0 ? page : 1} />;
}

export default function ReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AppShell>
      <AuthGuard>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <Suspense fallback={<p className="text-sm text-muted">Loading reader...</p>}>
            <ReadContent documentId={id} />
          </Suspense>
        </div>
      </AuthGuard>
    </AppShell>
  );
}
