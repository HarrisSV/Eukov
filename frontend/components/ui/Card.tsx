import { ReactNode } from "react";

interface CardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-border bg-surface p-6 shadow-sm ${className}`}
      aria-labelledby={`card-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <h2
        id={`card-${title.replace(/\s+/g, "-").toLowerCase()}`}
        className="mb-4 text-lg font-semibold text-foreground"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
