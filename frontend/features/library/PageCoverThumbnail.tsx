"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  COVER_PAGE_HEIGHT_PX,
  COVER_PAGE_WIDTH_PX,
  coverScaleForSize,
} from "@/lib/book-cover";

interface PageCoverThumbnailProps {
  pageHtml: string;
  className?: string;
}

export function PageCoverThumbnail({ pageHtml, className }: PageCoverThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const updateScale = () => {
      const { width, height } = node.getBoundingClientRect();
      setScale(coverScaleForSize(width, height));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pageHtml]);

  return (
    <div
      ref={containerRef}
      className={`library-page-cover ${className ?? ""}`.trim()}
      aria-hidden
    >
      <div
        className="library-page-cover__sheet tiptap"
        style={{
          width: COVER_PAGE_WIDTH_PX,
          height: COVER_PAGE_HEIGHT_PX,
          transform: `scale(${scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: pageHtml }}
      />
    </div>
  );
}
