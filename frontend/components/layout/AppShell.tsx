"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api, formatUserNickname } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

const baseNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/docket", label: "Docket" },
  { href: "/dashboard/library", label: "Library" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function TopNav() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await api.logout(refreshToken);
      }
    } catch {
      // Clear local session even if API call fails.
    } finally {
      clearSession();
      router.push("/register");
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="text-xl font-bold tracking-tight text-foreground">
          EUKOV
        </span>
        <span className="hidden text-sm text-muted sm:inline">
          Access Layer
        </span>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden text-sm text-muted md:inline">
            {formatUserNickname(user)}
          </span>
        )}
        <ThemeToggle />
        {user && (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  const user = useAuthStore((state) => state.user);
  const items = [...baseNav];
  if (user && roles.hasAtLeast(user.role, roles.Admin)) {
    items.splice(1, 0, { href: "/dashboard/admin", label: "Review Queue" });
  }
  if (user?.role === roles.SuperAdmin) {
    items.splice(1, 0, { href: "/dashboard/super-admin", label: "Super Admin" });
  }

  return items.map((item) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          active
            ? "bg-background text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {item.label}
      </Link>
    );
  });
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-surface md:block">
      <nav aria-label="Main navigation" className="flex flex-col gap-1 p-4">
        <NavLinks pathname={pathname} />
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface p-2 md:hidden"
    >
      <NavLinks pathname={pathname} />
    </nav>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <MobileNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
