import { GenreQuestionnaire } from "@/features/onboarding/GenreQuestionnaire";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export default function OnboardingGenresPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-page px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <GenreQuestionnaire />
    </main>
  );
}
