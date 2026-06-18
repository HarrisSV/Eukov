"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { api, formatUserNickname } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

const baseNav = [
  { href: "/dashboard", label: "Dashboard", short: "DB" },
  { href: "/dashboard/inbox", label: "Inbox", short: "In" },
  { href: "/dashboard/docket", label: "Docket", short: "Dk" },
  { href: "/dashboard/library", label: "Library", short: "Lb" },
  { href: "/dashboard/settings", label: "Settings", short: "St" },
];

const SIDEBAR_STORAGE_KEY = "eukov-sidebar-collapsed";

function readSidebarCollapsed(sidebarDefaultCollapsed: boolean): boolean {
  if (typeof window === "undefined") {
    return sidebarDefaultCollapsed;
  }
  const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored !== null) {
    return stored === "true";
  }
  return sidebarDefaultCollapsed;
}

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const value = useContext(SidebarContext);
  if (!value) {
    throw new Error("useSidebar must be used within AppShell");
  }
  return value;
}

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
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

function NavLinks({
  pathname,
  collapsed,
}: {
  pathname: string;
  collapsed: boolean;
}) {
  const user = useAuthStore((state) => state.user);
  const items = [...baseNav];
  if (user && roles.hasAtLeast(user.role, roles.Admin)) {
    items.splice(1, 0, {
      href: "/dashboard/admin",
      label: "Review Queue",
      short: "RQ",
    });
  }
  if (user?.role === roles.SuperAdmin) {
    items.splice(1, 0, {
      href: "/dashboard/super-admin",
      label: "Super Admin",
      short: "SA",
    });
  }

  return items.map((item) => {
    const active = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-label={item.label}
        className={`rounded-lg text-sm font-medium transition-colors hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          collapsed
            ? "flex h-9 w-9 items-center justify-center px-0 py-0 text-xs"
            : "px-3 py-2"
        } ${
          active
            ? "bg-background text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {collapsed ? item.short : item.label}
      </Link>
    );
  });
}

function SidebarToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      title={collapsed ? "Expand navigation" : "Collapse navigation"}
      className="mt-2 flex h-9 w-full items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-background hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        aria-hidden
        className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
      >
        <path
          d="M10 3 5 8l5 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={`hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 md:flex md:flex-col ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <nav
        aria-label="Main navigation"
        className={`flex flex-1 flex-col gap-1 p-2 ${collapsed ? "items-center" : ""}`}
      >
        <NavLinks pathname={pathname} collapsed={collapsed} />
      </nav>
      <div className={`border-t border-border p-2 ${collapsed ? "" : "px-3"}`}>
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface p-2 md:hidden"
    >
      <NavLinks pathname={pathname} collapsed={false} />
    </nav>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  /** Start with the sidebar collapsed (useful on editor-heavy pages). */
  sidebarDefaultCollapsed?: boolean;
  /** Reduce main padding and allow children to fill height. */
  compact?: boolean;
}

export function AppShell({
  children,
  sidebarDefaultCollapsed = false,
  compact = false,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() =>
    readSidebarCollapsed(sidebarDefaultCollapsed),
  );

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      <div className="flex min-h-screen flex-col bg-background">
        <TopNav />
        <MobileNav />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main
            className={`flex min-h-0 flex-1 flex-col ${
              compact ? "overflow-hidden p-2 md:p-3" : "p-4 md:p-6 lg:p-8"
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
