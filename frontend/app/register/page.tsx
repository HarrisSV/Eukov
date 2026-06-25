"use client";

import { useState } from "react";
import { EukovLogo } from "@/components/layout/EukovLogo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LoginForm } from "@/features/auth/LoginForm";
import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage() {
  const [mode, setMode] = useState<"register" | "login">("register");

  return (
    <main className="relative flex min-h-screen">
      <div className="absolute right-4 top-4 z-10 md:right-6 md:top-6">
        <ThemeToggle />
      </div>

      <section className="portal-hero hidden w-[42%] flex-col justify-between border-r border-border/70 p-10 lg:flex xl:p-14">
        <EukovLogo />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-warm">
            Publishing platform
          </p>
          <h1 className="mt-4 font-serif text-4xl font-semibold leading-tight text-foreground xl:text-5xl">
            Where stories find their readers.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Write in the docket, publish to the global library, and read beautifully in the EUKOV flipbook experience.
          </p>
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} EUKOV Infrastructure</p>
      </section>

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-12 md:px-8">
        <div className="mb-8 lg:hidden">
          <EukovLogo />
        </div>

        <div
          className="mb-8 inline-flex rounded-xl border border-border/80 bg-surface/80 p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            onClick={() => setMode("register")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
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
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            Login
          </button>
        </div>

        <div className="mb-8 max-w-md text-center">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">
            {mode === "register" ? "Create your account" : "Welcome back"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {mode === "register"
              ? "Join EUKOV and tell us what you like to read."
              : "Login using the email and password you registered with."}
          </p>
        </div>

        <div className="portal-card w-full max-w-md rounded-2xl border border-border/70 bg-background p-6 md:p-8">
          {mode === "register" ? <RegisterForm /> : <LoginForm />}
        </div>
      </section>
    </main>
  );
}
