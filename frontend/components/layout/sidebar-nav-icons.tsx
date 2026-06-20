type NavIconProps = {
  className?: string;
};

export function UserIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="5.25" r="2.25" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path
        d="M3.5 13.25c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function SuperAdminIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M8 1.5 9.8 5.2l4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4L2.2 5.8l4-.6L8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function ReviewQueueIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="3.5" y="2" width="9" height="12" rx="1" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M6 2V1.25A.75.75 0 0 1 6.75.5h2.5a.75.75 0 0 1 .75.75V2" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path d="M5.5 6.5h5M5.5 9h5M5.5 11.5h3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M2 4.5A1.5 1.5 0 0 1 3.5 3h9A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      />
      <path d="M2 6.5h3.2a1 1 0 0 1 .8.4l.7.93a1 1 0 0 0 .8.4h2.6a1 1 0 0 0 .8-.4l.7-.93a1 1 0 0 1 .8-.4H14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function DocketIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M4.5 1.5h7A1.5 1.5 0 0 1 13 3v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13V3a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        fill="none"
      />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function LibraryIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M3 13V4.5a1 1 0 0 1 1.45-.89L7 5.2V13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none" />
      <path d="M7 5.2 10.55 3.6A1 1 0 0 1 12 4.5V13" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none" />
      <path d="M3 13h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ className }: NavIconProps) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" fill="none" />
      <path
        d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M3.4 12.6l.85-.85M11.75 4.25l.85-.85"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
