"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
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

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace("/register");
      return;
    }
    if (minRole && !roles.hasAtLeast(user.role, minRole)) {
      router.replace("/dashboard");
    }
  }, [accessToken, user, minRole, router]);

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
