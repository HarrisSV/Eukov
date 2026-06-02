import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Card title="Appearance">
          <p className="mb-4 text-sm text-muted">
            Switch between light and dark themes.
          </p>
          <ThemeToggle />
        </Card>
      </div>
    </AppShell>
  );
}
