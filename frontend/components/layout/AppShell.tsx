"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { EukovLogo } from "@/components/layout/EukovLogo";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  UserIcon,
  DocketIcon,
  InboxIcon,
  LibraryIcon,
  ReviewQueueIcon,
  SettingsIcon,
} from "@/components/layout/sidebar-nav-icons";
import { api, formatUserNickname } from "@/services/api";
import { useAuthStore } from "@/store/authStore";
import { roles } from "@/lib/roles";

type NavItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const baseNav: NavItem[] = [
  { href: "/dashboard", label: "You", Icon: UserIcon },
  { href: "/dashboard/inbox", label: "Inbox", Icon: InboxIcon },
  { href: "/dashboard/docket", label: "Docket", Icon: DocketIcon },
  { href: "/dashboard/library", label: "Library", Icon: LibraryIcon },
  { href: "/dashboard/settings", label: "Settings", Icon: SettingsIcon },
];

const SIDEBAR_WIDTH_KEY = "eukov-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "eukov-sidebar-collapsed";
const SIDEBAR_MIN = 72;
const SIDEBAR_MAX = 240;
const SIDEBAR_LABEL_TEXT_WIDTH = 99;
const SIDEBAR_RIGHT_PAD = 20;
const LABEL_OFFSET = 46;
const LABEL_MAX = SIDEBAR_LABEL_TEXT_WIDTH;
const SIDEBAR_DEFAULT = LABEL_OFFSET + SIDEBAR_LABEL_TEXT_WIDTH + SIDEBAR_RIGHT_PAD;
const SIDEBAR_SNAP = 148;
const SIDEBAR_EXPANDED_MIN = SIDEBAR_DEFAULT;
const LEGACY_EXPANDED_WIDTHS = new Set([208, 224, 240, 280]);
const SIDEBAR_ANIMATION_MS = 240;

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width));
}

function snapSidebarWidth(width: number) {
  if (width < SIDEBAR_SNAP) {
    return SIDEBAR_MIN;
  }
  return clampSidebarWidth(Math.max(width, SIDEBAR_EXPANDED_MIN));
}

function isSidebarCollapsed(width: number) {
  return width < SIDEBAR_SNAP;
}

function readSidebarWidth(): number {
  if (typeof window === "undefined") {
    return SIDEBAR_DEFAULT;
  }

  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true") {
    return SIDEBAR_MIN;
  }

  const storedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (storedWidth !== null) {
    const parsed = Number(storedWidth);
    if (!Number.isNaN(parsed)) {
      if (parsed >= SIDEBAR_EXPANDED_MIN) {
        if (LEGACY_EXPANDED_WIDTHS.has(parsed)) {
          return SIDEBAR_DEFAULT;
        }
        return clampSidebarWidth(parsed);
      }
      if (parsed >= SIDEBAR_SNAP) {
        return SIDEBAR_DEFAULT;
      }
    }
  }

  return SIDEBAR_DEFAULT;
}

function getLabelReveal(width: number, label: string) {
  const labelSlot = Math.max(0, width - LABEL_OFFSET);
  const estimatedWidth = label.length * 7.5;

  if (width <= SIDEBAR_SNAP || labelSlot <= 0) {
    return { maxWidth: 0, opacity: 0, fadeEdge: false };
  }

  if (width >= SIDEBAR_EXPANDED_MIN) {
    return { maxWidth: LABEL_MAX, opacity: 1, fadeEdge: false };
  }

  const progress = (width - SIDEBAR_SNAP) / (SIDEBAR_EXPANDED_MIN - SIDEBAR_SNAP);

  return {
    maxWidth: labelSlot,
    opacity: Math.min(1, 0.35 + progress * 0.65),
    fadeEdge: labelSlot < estimatedWidth - 2,
  };
}

function SidebarNavLabel({ label, width }: { label: string; width: number }) {
  const reveal = getLabelReveal(width, label);

  if (reveal.maxWidth <= 0) {
    return null;
  }

  return (
    <span
      className="min-w-0 overflow-hidden whitespace-nowrap"
      style={{
        maxWidth: reveal.maxWidth,
        opacity: reveal.opacity,
        ...(reveal.fadeEdge
          ? {
              WebkitMaskImage:
                "linear-gradient(to right, #000 0%, #000 calc(100% - 18px), rgba(0,0,0,0.45) calc(100% - 8px), transparent 100%)",
              maskImage:
                "linear-gradient(to right, #000 0%, #000 calc(100% - 18px), rgba(0,0,0,0.45) calc(100% - 8px), transparent 100%)",
            }
          : {}),
      }}
      aria-hidden={reveal.opacity < 0.2}
    >
      {label}
    </span>
  );
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function persistSidebarWidth(width: number) {
  const collapsed = isSidebarCollapsed(width);
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(collapsed ? SIDEBAR_DEFAULT : width));
}

type SidebarContextValue = {
  width: number;
  collapsed: boolean;
  resizing: boolean;
  animating: boolean;
  startResize: () => void;
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

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function TopNav() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearSession = useAuthStore((state) => state.clearSession);

  const inboxQuery = useQuery({
    queryKey: ["inbox"],
    queryFn: async () => (await api.getInbox()).messages,
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  });

  const unreadCount = inboxQuery.data?.filter((message) => !message.readAt).length ?? 0;
  const displayName = user ? formatUserNickname(user) : "";

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
    <header className="flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border/70 bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <div className="flex items-center gap-2">
        <ThemeToggle compact />
        <Link
          href="/dashboard/inbox"
          aria-label={`Inbox${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background text-muted transition-colors hover:border-accent-warm/40 hover:bg-accent-soft hover:text-foreground"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-warm" />
          ) : null}
        </Link>

        {user ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-background py-1 pl-1 pr-2.5 md:pr-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground">
              {userInitials(displayName)}
            </span>
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="text-xs text-muted transition-colors hover:text-accent-warm"
              >
                Logout
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function NavLinks({ pathname, width }: { pathname: string; width: number }) {
  const user = useAuthStore((state) => state.user);
  const items: NavItem[] = [...baseNav];
  if (user && roles.hasAtLeast(user.role, roles.Admin)) {
    items.splice(1, 0, {
      href: "/dashboard/admin",
      label: "Review Queue",
      Icon: ReviewQueueIcon,
    });
  }

  return items.map((item) => {
    const active = pathname === item.href;
    const { Icon } = item;
    const expanding = width >= SIDEBAR_SNAP;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        className={`flex h-10 w-full items-center overflow-hidden rounded-xl text-sm font-medium transition-all duration-150 ease-out ${
          expanding ? "justify-start gap-3 px-3" : "justify-center px-2"
        } ${
          active
            ? "bg-accent-soft text-accent-warm shadow-sm"
            : "text-muted hover:bg-surface hover:text-foreground"
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-accent-warm" : ""}`} />
        <SidebarNavLabel label={item.label} width={width} />
      </Link>
    );
  });
}

function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
      title={collapsed ? "Expand navigation" : "Collapse navigation"}
      className="flex h-9 w-full items-center justify-center rounded-xl border border-border/80 text-muted transition-colors hover:bg-surface hover:text-foreground"
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
  const { width, collapsed, resizing, animating, startResize, toggle } = useSidebar();
  const showBranding = width >= SIDEBAR_SNAP;

  return (
    <aside
      style={{ width }}
      className={`relative hidden h-full min-h-0 shrink-0 flex-col border-r border-border/70 bg-surface/40 md:flex ${
        resizing || animating ? "" : "transition-[width] duration-150 ease-out"
      }`}
    >
      <div className={`shrink-0 border-b border-border/70 ${showBranding ? "px-4 py-5" : "flex justify-center py-4"}`}>
        <EukovLogo compact={!showBranding} />
      </div>

      <nav
        aria-label="Main navigation"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
      >
        <p
          className={`mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted ${
            showBranding ? "opacity-100" : "sr-only"
          }`}
        >
          Navigate
        </p>
        <NavLinks pathname={pathname} width={width} />
      </nav>

      <div className="border-t border-border/70 p-3">
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize navigation"
        title="Drag to resize navigation"
        onMouseDown={(event) => {
          event.preventDefault();
          startResize();
        }}
        className={`absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize touch-none ${
          resizing ? "bg-accent-warm/35" : "hover:bg-accent-warm/20"
        }`}
      />
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile navigation"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/70 bg-surface/50 p-2 md:hidden"
    >
      <NavLinks pathname={pathname} width={SIDEBAR_EXPANDED_MIN} />
    </nav>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  compact?: boolean;
  hideSidebar?: boolean;
}

export function AppShell({ children, compact = false, hideSidebar = false }: AppShellProps) {
  const [width, setWidth] = useState(SIDEBAR_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const [animating, setAnimating] = useState(false);
  const widthRef = useRef(SIDEBAR_DEFAULT);
  const animationRef = useRef<number | null>(null);
  const expandedWidthRef = useRef(SIDEBAR_DEFAULT);

  useEffect(() => {
    const stored = readSidebarWidth();
    widthRef.current = stored;
    expandedWidthRef.current = stored >= SIDEBAR_EXPANDED_MIN ? stored : SIDEBAR_DEFAULT;
    setWidth(stored);
  }, []);

  const collapsed = isSidebarCollapsed(width);

  const cancelWidthAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAnimating(false);
  }, []);

  const animateSidebarWidth = useCallback(
    (target: number, onComplete?: () => void) => {
      cancelWidthAnimation();
      setAnimating(true);

      const from = widthRef.current;
      const start = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / SIDEBAR_ANIMATION_MS);
        const eased = easeInOutCubic(progress);
        const next = Math.round(from + (target - from) * eased);
        widthRef.current = next;
        setWidth(next);

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = null;
          setAnimating(false);
          onComplete?.();
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [cancelWidthAnimation],
  );

  const startResize = useCallback(() => {
    cancelWidthAnimation();
    setResizing(true);
  }, [cancelWidthAnimation]);

  const toggle = useCallback(() => {
    const current = widthRef.current;
    if (isSidebarCollapsed(current)) {
      const next = expandedWidthRef.current;
      animateSidebarWidth(next, () => persistSidebarWidth(next));
      return;
    }

    expandedWidthRef.current = Math.max(current, SIDEBAR_EXPANDED_MIN);
    animateSidebarWidth(SIDEBAR_MIN, () => persistSidebarWidth(SIDEBAR_MIN));
  }, [animateSidebarWidth]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: MouseEvent) => {
      const next = clampSidebarWidth(event.clientX);
      widthRef.current = next;
      setWidth(next);
    };

    const onUp = () => {
      setResizing(false);
      const snapped = snapSidebarWidth(widthRef.current);
      if (!isSidebarCollapsed(snapped)) {
        expandedWidthRef.current = snapped;
      }

      if (Math.abs(snapped - widthRef.current) > 2) {
        animateSidebarWidth(snapped, () => persistSidebarWidth(snapped));
        return;
      }

      widthRef.current = snapped;
      setWidth(snapped);
      persistSidebarWidth(snapped);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing, animateSidebarWidth]);

  useEffect(() => () => cancelWidthAnimation(), [cancelWidthAnimation]);

  return (
    <SidebarContext.Provider
      value={{ width, collapsed, resizing, animating, startResize, toggle }}
    >
      <div className="relative flex h-screen flex-col bg-page p-0 md:p-3 lg:p-4">
        <div className="portal-shell portal-animate-in flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-border/60 bg-background md:rounded-[1.25rem]">
          {!hideSidebar && (
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 md:hidden">
              <EukovLogo />
            </div>
          )}
          <TopNav />
          {!hideSidebar && <MobileNav />}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {!hideSidebar && <Sidebar />}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <main
                className={`portal-animate-in flex min-h-0 flex-1 flex-col ${
                  compact ? "overflow-hidden p-2 md:p-3" : "overflow-y-auto p-4 md:p-8 lg:p-10"
                }`}
              >
                {children}
              </main>
              {!compact && <PortalFooter />}
            </div>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
