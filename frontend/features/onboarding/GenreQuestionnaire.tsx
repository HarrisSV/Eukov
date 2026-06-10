"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, formatGenreLabel } from "@/services/api";
import { useUserStore } from "@/store/userStore";

export function GenreQuestionnaire() {
  const router = useRouter();
  const userId = useUserStore((state) => state.userId);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["genres"],
    queryFn: api.getGenres,
  });

  const toggleGenre = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name],
    );
  };

  const handleSubmit = async () => {
    if (!userId) {
      router.push("/register");
      return;
    }

    if (selected.length === 0) {
      setSubmitError("Select at least one genre.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await api.savePreferences(selected);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError("Failed to save preferences.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p className="text-muted">Loading genres...</p>;
  }

  if (error) {
    return <p className="text-danger">Failed to load genres.</p>;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Choose your interests</h1>
        <p className="mt-2 text-muted">
          Select the genres you enjoy reading. You can pick multiple options.
        </p>
      </div>

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="group"
        aria-label="Genre preferences"
      >
        {data?.genres.map((genre) => {
          const isSelected = selected.includes(genre.name);
          return (
            <button
              key={genre.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleGenre(genre.name)}
              className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                isSelected
                  ? "border-accent bg-surface text-foreground"
                  : "border-border bg-background text-muted hover:text-foreground"
              }`}
            >
              {formatGenreLabel(genre.name)}
            </button>
          );
        })}
      </div>

      {submitError && (
        <p className="text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Saving..." : "Continue to Dashboard"}
      </button>
    </div>
  );
}
