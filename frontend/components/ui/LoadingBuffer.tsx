import { QwenAILogo } from "@/components/ui/QwenAILogo";
import "./loading-buffer.css";

interface LoadingBufferProps {
  title: string;
  detail?: string;
  className?: string;
  variant?: "default" | "qwen";
  eyebrow?: string;
}

export function LoadingBuffer({
  title,
  detail,
  className,
  variant = "default",
  eyebrow = "Qwen AI",
}: LoadingBufferProps) {
  const isQwen = variant === "qwen";

  return (
    <div
      className={`loading-buffer${isQwen ? " loading-buffer--qwen" : ""}${
        className ? ` ${className}` : ""
      }`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {isQwen ? (
        <div className="loading-buffer__logo-wrap" aria-hidden>
          <QwenAILogo className="loading-buffer__logo" />
        </div>
      ) : null}
      {isQwen ? <p className="loading-buffer__eyebrow">{eyebrow}</p> : null}
      <div className="loading-buffer__track" aria-hidden="true">
        <div className="loading-buffer__fill" />
      </div>
      <p className="loading-buffer__title">{title}</p>
      {detail ? <p className="loading-buffer__detail">{detail}</p> : null}
    </div>
  );
}
