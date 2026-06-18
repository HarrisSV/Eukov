type AlignIconProps = {
  className?: string;
};

export function AlignLeftIcon({ className }: AlignIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 2.5h12M2 6h8M2 9.5h11M2 13h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function AlignCenterIcon({ className }: AlignIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 2.5h12M4 6h8M3 9.5h10M4 13h8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function AlignRightIcon({ className }: AlignIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 2.5h12M6 6h8M3 9.5h11M5 13h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function AlignJustifyIcon({ className }: AlignIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M2 2.5h12M2 6h12M2 9.5h12M2 13h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
