"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError, NetworkError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";

const schema = z.object({
  accessKey: z.string().trim().min(16, "Enter the full access key"),
});

type FormValues = z.infer<typeof schema>;

type AccessKeyFormProps = {
  defaultAccessKey?: string;
  compact?: boolean;
  onSuccess?: () => void;
};

export function AccessKeyForm({
  defaultAccessKey,
  compact = false,
  onSuccess,
}: AccessKeyFormProps) {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { accessKey: defaultAccessKey ?? "" },
  });

  useEffect(() => {
    if (defaultAccessKey) {
      setValue("accessKey", defaultAccessKey);
    }
  }, [defaultAccessKey, setValue]);

  const onSubmit = async (values: FormValues) => {
    setMessage(null);
    setError(null);
    try {
      const result = await api.consumeAccessKey(values.accessKey);
      if (accessToken && refreshToken) {
        const me = await api.me();
        setSession(accessToken, refreshToken, me);
      }
      setMessage(
        result.role === "AUTHOR"
          ? "You are now an Author. Open your Docket to start writing."
          : `Promotion successful. Your role is now ${result.role}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["author-application-mine"] });
      reset();
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError || err instanceof NetworkError) {
        setError(err.message);
      } else {
        setError("Could not redeem access key.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={compact ? "mt-3 flex flex-col gap-2" : "flex flex-col gap-4"}
    >
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
        className={
          compact
            ? "w-fit rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
            : "rounded-lg bg-accent px-4 py-2 font-medium text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
        }
      >
        {isSubmitting ? "Validating..." : "Redeem Access Key"}
      </button>
    </form>
  );
}
