"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

interface AuthGuardProps {
  children: ReactNode;
  minRole?: string;
}

export function AuthGuard({ children, minRole }: AuthGuardProps) {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/register");
      return;
    }
    if (minRole && !roles.hasAtLeast(user.role, minRole)) {
      router.replace("/dashboard");
    }
  }, [accessToken, user, minRole, router]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    api
      .me()
      .then((profile) => updateUser(profile))
      .catch(() => {
        // Keep the existing session if profile refresh fails.
      });
  }, [accessToken, updateUser]);

  if (!accessToken || !user) {
    return (
      <p className="text-sm text-muted" role="status">
        Checking session...
      </p>
    );
  }

  if (minRole && !roles.hasAtLeast(user.role, minRole)) {
    return (
      <p className="text-sm text-muted" role="status">
        Redirecting...
      </p>
    );
  }

  return <>{children}</>;
}
