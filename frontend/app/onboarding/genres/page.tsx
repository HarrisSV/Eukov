import { GenreQuestionnaire } from "@/features/onboarding/GenreQuestionnaire";
import { EukovLogo } from "@/components/layout/EukovLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function OnboardingGenresPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-8">
        <EukovLogo />
      </div>
      <div className="portal-card w-full max-w-2xl rounded-2xl border border-border/70 bg-background p-6 md:p-8">
        <GenreQuestionnaire />
      </div>
    </main>
  );
}
