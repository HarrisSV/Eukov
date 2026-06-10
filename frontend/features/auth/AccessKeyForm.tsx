"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError, NetworkError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

const schema = z.object({
  accessKey: z.string().min(16, "Enter the full access key"),
});

type FormValues = z.infer<typeof schema>;

export function AccessKeyForm() {
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const user = useAuthStore((s) => s.user);
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
      const result = await api.consumeAccessKey(values.accessKey);
      if (user && accessToken && refreshToken) {
        setSession(accessToken, refreshToken, { ...user, role: result.role });
      }
      setMessage(`Promotion successful. Your role is now ${result.role}.`);
      reset();
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Could not redeem access key.");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label htmlFor="accessKey" className="mb-1 block text-sm font-medium">
          Admin Access Key
        </label>
        <input
          id="accessKey"
          type="text"
          autoComplete="off"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
          {...register("accessKey")}
        />
        {errors.accessKey && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.accessKey.message}
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
        {isSubmitting ? "Validating..." : "Redeem Access Key"}
      </button>
    </form>
  );
}
