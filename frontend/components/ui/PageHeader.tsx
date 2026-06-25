interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
}

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <header className="mb-6 md:mb-8">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-warm">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
