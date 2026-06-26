import { useId } from "react";

interface QwenAILogoProps {
  className?: string;
}

export function QwenAILogo({ className }: QwenAILogoProps) {
  const gradientId = useId();

  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Qwen AI"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6C4DFF" />
          <stop offset="55%" stopColor="#4F8CFF" />
          <stop offset="100%" stopColor="#2ED0C7" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="54" fill={`url(#${gradientId})`} opacity="0.14" />
      <path
        d="M34 78c8-18 22-28 26-28s18 10 26 28"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M42 48c6-10 14-14 18-14s12 4 18 14"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="10" fill={`url(#${gradientId})`} />
    </svg>
  );
}
