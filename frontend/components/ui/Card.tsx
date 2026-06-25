import { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  badge?: string;
  headerAction?: ReactNode;
  description?: string;
  variant?: "default" | "hero" | "ghost";
}

export function Card({
  title,
  children,
  className = "",
  icon,
  badge,
  headerAction,
  description,
  variant = "default",
}: CardProps) {
  const titleId = `card-${title.replace(/\s+/g, "-").toLowerCase()}`;

  const variantClass =
    variant === "hero"
      ? "portal-hero border-accent-warm/20"
      : variant === "ghost"
        ? "border-transparent bg-transparent shadow-none"
        : "border-border/70 bg-background";

  return (
    <section
      className={`portal-card rounded-2xl border p-5 md:p-6 ${variantClass} ${className}`}
      aria-labelledby={titleId}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            {icon ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-warm">
                {icon}
              </span>
            ) : null}
            <h2 id={titleId} className="font-serif text-lg font-semibold text-foreground md:text-xl">
              {title}
            </h2>
            {badge ? (
              <span className="rounded-full border border-border/80 bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
