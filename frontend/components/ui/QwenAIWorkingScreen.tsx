"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { QwenAILogo } from "@/components/ui/QwenAILogo";
import "./qwen-ai-working.css";

interface QwenAIWorkingScreenProps {
  open: boolean;
  title: string;
  detail?: string;
  eyebrow?: string;
  statusMessages?: string[];
  /** Render as a full-viewport overlay via portal. */
  overlay?: boolean;
}

export function QwenAIWorkingScreen({
  open,
  title,
  detail,
  eyebrow = "Qwen AI",
  statusMessages,
  overlay = true,
}: QwenAIWorkingScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);

  const messages = useMemo(
    () => (statusMessages && statusMessages.length > 0 ? statusMessages : []),
    [statusMessages],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || messages.length === 0) {
      setStatusIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % messages.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [messages, open]);

  useEffect(() => {
    if (!open || !overlay || !mounted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mounted, open, overlay]);

  if (!open || !mounted) {
    return null;
  }

  const content = (
    <div
      className={`qwen-ai-working${overlay ? " qwen-ai-working--overlay" : " qwen-ai-working--inline"}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="qwen-ai-working__eyebrow">{eyebrow}</p>

      <div className="qwen-ai-working__logo-wrap" aria-hidden>
        <span className="qwen-ai-working__ring qwen-ai-working__ring--outer" />
        <span className="qwen-ai-working__ring qwen-ai-working__ring--inner" />
        <span className="qwen-ai-working__glow" />
        <QwenAILogo className="qwen-ai-working__logo" />
      </div>

      <div className="qwen-ai-working__track" aria-hidden>
        <div className="qwen-ai-working__fill" />
        <div className="qwen-ai-working__scanline" />
      </div>

      <div className="qwen-ai-working__dots" aria-hidden>
        <span className="qwen-ai-working__dot" />
        <span className="qwen-ai-working__dot" />
        <span className="qwen-ai-working__dot" />
      </div>

      <p className="qwen-ai-working__title">{title}</p>
      {detail ? <p className="qwen-ai-working__detail">{detail}</p> : null}
      {messages.length > 0 ? (
        <p key={statusIndex} className="qwen-ai-working__status">
          {messages[statusIndex]}
        </p>
      ) : null}
    </div>
  );

  if (overlay) {
    return createPortal(content, document.body);
  }

  return content;
}
