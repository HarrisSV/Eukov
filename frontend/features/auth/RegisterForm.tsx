"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, ApiError, NetworkError } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1, "Last name is required"),
    nickname: z.string().trim().min(1, "Nickname is required"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const setUser = useUserStore((state) => state.setUser);
  const setSession = useAuthStore((state) => state.setSession);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setSubmitError(null);
    try {
      await api.register({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        middleName: values.middleName || undefined,
        lastName: values.lastName,
        nickname: values.nickname,
      });
      const session = await api.login(values.email, values.password);
      setSession(session.accessToken, session.refreshToken, session.user);
      setUser(session.user.id, session.user.email);
      router.push("/onboarding/genres");
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
      } else if (error instanceof NetworkError) {
        setSubmitError(error.message);
      } else {
        setSubmitError("Registration failed. Please try again.");
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-md flex-col gap-4"
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1 block text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            className="portal-input w-full px-3 py-2"
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className="mt-1 text-sm text-danger" role="alert">
              {errors.firstName.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="middleName" className="mb-1 block text-sm font-medium">
            Middle name
          </label>
          <input
            id="middleName"
            type="text"
            autoComplete="additional-name"
            className="portal-input w-full px-3 py-2"
            {...register("middleName")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="lastName" className="mb-1 block text-sm font-medium">
          Last name
        </label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          className="portal-input w-full px-3 py-2"
          {...register("lastName")}
        />
        {errors.lastName && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.lastName.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="nickname" className="mb-1 block text-sm font-medium">
          Nickname
        </label>
        <input
          id="nickname"
          type="text"
          autoComplete="nickname"
          className="portal-input w-full px-3 py-2"
          {...register("nickname")}
        />
        <p className="mt-1 text-xs text-muted">
          This is how you&apos;ll appear on the platform.
        </p>
        {errors.nickname && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.nickname.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
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
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="portal-input w-full px-3 py-2"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.password.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="mb-1 block text-sm font-medium"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          className="portal-input w-full px-3 py-2"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-danger" role="alert">
            {errors.confirmPassword.message}
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
        {isSubmitting ? "Creating account..." : "Create Account"}
      </button>
    </form>
  );
}
