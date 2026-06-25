"use client";

import { useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LoginForm } from "@/features/auth/LoginForm";
import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage() {
  const [mode, setMode] = useState<"register" | "login">("register");

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-page px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div
        className="mb-6 inline-flex rounded-lg border border-border bg-surface p-1"
        role="tablist"
        aria-label="Authentication mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "register"}
          onClick={() => setMode("register")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "register"
              ? "bg-background text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Register
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => setMode("login")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === "login"
              ? "bg-background text-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          Login
        </button>
      </div>

      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          {mode === "register" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-muted">
          {mode === "register"
            ? "Join EUKOV and tell us what you like to read."
            : "Login using the email and password you registered with."}
        </p>
      </div>

      {mode === "register" ? <RegisterForm /> : <LoginForm />}
    </main>
  );
}
