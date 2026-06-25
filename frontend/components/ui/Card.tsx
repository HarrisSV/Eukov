import { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  badge?: string;
  headerAction?: ReactNode;
  description?: string;
}

export function Card({
  title,
  children,
  className = "",
  icon,
  badge,
  headerAction,
  description,
}: CardProps) {
  const titleId = `card-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section
      className={`portal-card rounded-2xl border border-border/80 bg-background p-5 shadow-sm md:p-6 ${className}`}
      aria-labelledby={titleId}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {icon}
              </span>
            ) : null}
            <h2 id={titleId} className="text-base font-semibold text-foreground md:text-lg">
              {title}
            </h2>
            {badge ? (
              <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
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
