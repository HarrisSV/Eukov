"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QwenAILogo } from "@/components/ui/QwenAILogo";
import "./qwen-ai-loading.css";

interface QwenAIWorkingOverlayProps {
  open: boolean;
  title: string;
  detail?: string;
  eyebrow?: string;
}

export function QwenAIWorkingOverlay({
  open,
  title,
  detail,
  eyebrow = "Qwen AI",
}: QwenAIWorkingOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div className="qwen-ai-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="qwen-ai-overlay__backdrop" aria-hidden />
      <div className="qwen-ai-overlay__content">
        <div className="qwen-ai-overlay__logo-wrap" aria-hidden>
          <span className="qwen-ai-overlay__ring qwen-ai-overlay__ring--1" />
          <span className="qwen-ai-overlay__ring qwen-ai-overlay__ring--2" />
          <span className="qwen-ai-overlay__ring qwen-ai-overlay__ring--3" />
          <QwenAILogo className="qwen-ai-overlay__logo" />
        </div>
        <p className="qwen-ai-overlay__eyebrow">{eyebrow}</p>
        <p className="qwen-ai-overlay__title">{title}</p>
        {detail ? <p className="qwen-ai-overlay__detail">{detail}</p> : null}
        <div className="qwen-ai-overlay__track" aria-hidden>
          <div className="qwen-ai-overlay__fill" />
        </div>
        <div className="qwen-ai-overlay__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>,
    document.body,
  );
}
