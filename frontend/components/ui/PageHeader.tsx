interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className="mb-2">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 max-w-3xl text-sm text-muted md:text-base">{description}</p>
      ) : null}
    </header>
  );
}
