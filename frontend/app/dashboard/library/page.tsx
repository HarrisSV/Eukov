import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";

export default function LibraryPage() {
  return (
    <AppShell>
      <Card title="Library">
        <p className="text-sm text-muted">
          Library and subscriptions will be available in Phase 4.
        </p>
      </Card>
    </AppShell>
  );
}
