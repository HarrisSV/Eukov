import Link from "next/link";

interface EukovLogoProps {
  compact?: boolean;
  className?: string;
}

export function EukovLogo({ compact = false, className = "" }: EukovLogoProps) {
  return (
    <Link
      href="/dashboard"
      className={`group flex items-center gap-3 ${className}`}
      aria-label="EUKOV Management Portal"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm transition-transform duration-200 group-hover:scale-[1.03]">
        <span className="font-serif text-lg font-semibold leading-none tracking-tight">E</span>
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-accent-warm"
          aria-hidden
        />
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="block font-serif text-lg font-semibold leading-tight tracking-tight text-foreground">
            EUKOV
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
            Management Portal
          </span>
        </span>
      ) : null}
    </Link>
  );
}
