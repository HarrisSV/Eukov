"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError, NetworkError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const setUser = useUserStore((state) => state.setUser);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    try {
      const result = await api.login(values.email, values.password);
      setSession(result.accessToken, result.refreshToken, result.user);
      setUser(result.user.id, result.user.email);
      const existingPrefs = await api.getPreferences(result.user.id);
      if (existingPrefs.genres.length === 0) {
        router.push("/onboarding/genres");
        return;
      }
      router.push("/dashboard");
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else if (error instanceof NetworkError) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Login failed. Please try again.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-md flex-col gap-4"
      noValidate
    >
      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          className="portal-input w-full px-3 py-2"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="portal-input w-full px-3 py-2"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-danger" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="portal-btn-primary w-full px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
