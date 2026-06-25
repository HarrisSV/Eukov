import "./loading-buffer.css";

interface LoadingBufferProps {
  title: string;
  detail?: string;
  className?: string;
}

export function LoadingBuffer({ title, detail, className }: LoadingBufferProps) {
  return (
    <div
      className={`loading-buffer${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-buffer__track" aria-hidden="true">
        <div className="loading-buffer__fill" />
      </div>
      <p className="loading-buffer__title">{title}</p>
      {detail ? <p className="loading-buffer__detail">{detail}</p> : null}
    </div>
  );
}
