"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError, NetworkError } from "@/services/api";

const schema = z.object({
  qualifications: z.string().min(10, "Add at least 10 characters"),
  experience: z.string().min(10, "Add at least 10 characters"),
});

type FormValues = z.infer<typeof schema>;

export function AuthorApplicationForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setMessage(null);
    setError(null);
    try {
      const result = await api.submitAuthorApplication(
        values.qualifications,
        values.experience,
      );
      setMessage(`Application submitted (${result.status}).`);
      reset();
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Could not submit application.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label htmlFor="qualifications" className="mb-1 block text-sm font-medium">
          Qualifications
        </label>
        <textarea
          id="qualifications"
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          {...register("qualifications")}
        />
        {errors.qualifications && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.qualifications.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="experience" className="mb-1 block text-sm font-medium">
          Experience
        </label>
        <textarea
          id="experience"
          rows={4}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          {...register("experience")}
        />
        {errors.experience && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.experience.message}
          </p>
        )}
      </div>
      {message && (
        <p className="text-sm text-success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
      >
        {isSubmitting ? "Submitting..." : "Apply for Author Status"}
      </button>
    </form>
  );
}
