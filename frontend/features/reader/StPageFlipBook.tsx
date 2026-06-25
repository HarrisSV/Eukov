"use client";

import dynamic from "next/dynamic";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { isHtmlContent, type ReaderSpreadMode } from "@/features/reader/page-content";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

export type { ReaderSpreadMode };

export interface StPageFlipBookHandle {
  flipNext(): void;
  flipPrev(): void;
  turnToPage(pageIndex: number): void;
  flipToPage(pageIndex: number): void;
  getCurrentPageIndex(): number;
}

interface StPageFlipBookProps {
  pages: Array<{ pageNumber: number; content: string }>;
  startPageIndex: number;
  spreadMode?: ReaderSpreadMode;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  onFlip?: (pageIndex: number) => void;
  onFlippingChange?: (flipping: boolean) => void;
}

interface BookDimensions {
  pageWidth: number;
  pageHeight: number;
}

const MIN_HOST = { width: 120, height: 120 };

export const READER_ZOOM_MIN = 50;
export const READER_ZOOM_MAX = 200;
export const READER_ZOOM_STEP = 10;
export const READER_ZOOM_DEFAULT = 100;

export function clampReaderZoom(value: number): number {
  return Math.min(READER_ZOOM_MAX, Math.max(READER_ZOOM_MIN, value));
}

function measureMinZoomFit(host: HTMLElement, baseScale: number): number {
  let fit = 1;

  for (const container of host.querySelectorAll<HTMLElement>(".reader-page__text")) {
    const inner = container.querySelector<HTMLElement>(".reader-page__text-inner");
    if (!inner) {
      continue;
    }

    const currentZoom = parseFloat(getComputedStyle(inner).zoom) || 1;
    const unscaledHeight = inner.offsetHeight / currentZoom;
    const neededAtBase = unscaledHeight * baseScale;
    const available = container.clientHeight;

    if (available > 0 && neededAtBase > available + 1) {
      fit = Math.min(fit, available / neededAtBase);
    }
  }

  return fit;
}

function measureHost(host: HTMLElement, spreadMode: ReaderSpreadMode): BookDimensions | null {
  const width = Math.floor(host.clientWidth);
  const height = Math.floor(host.clientHeight);
  if (width < MIN_HOST.width || height < MIN_HOST.height) {
    return null;
  }

  if (spreadMode === "single") {
    return {
      pageWidth: Math.max(200, width),
      pageHeight: Math.max(220, height),
    };
  }

  return {
    pageWidth: Math.max(160, Math.floor(width / 2)),
    pageHeight: Math.max(220, height),
  };
}

export const StPageFlipBook = forwardRef<StPageFlipBookHandle, StPageFlipBookProps>(
  function StPageFlipBook(
    {
      pages,
      startPageIndex,
      spreadMode = "double",
      zoom = READER_ZOOM_DEFAULT,
      onZoomChange,
      onFlip,
      onFlippingChange,
    },
    ref,
  ) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const bookRef = useRef<{ pageFlip(): PageFlipApi } | null>(null);
    const flippingRef = useRef(false);
    const zoomRef = useRef(zoom);
    const onZoomChangeRef = useRef(onZoomChange);
    const prevEffectiveScaleRef = useRef(READER_ZOOM_DEFAULT / 100);
    const [dims, setDims] = useState<BookDimensions | null>(null);
    const [minZoomFit, setMinZoomFit] = useState(1);

    zoomRef.current = zoom;
    onZoomChangeRef.current = onZoomChange;

    const baseScale = zoom / 100;
    const effectiveScale =
      zoom === READER_ZOOM_MIN ? baseScale * minZoomFit : baseScale;

    const spreadModeRef = useRef(spreadMode);
    spreadModeRef.current = spreadMode;

    useImperativeHandle(ref, () => ({
      flipNext() {
        bookRef.current?.pageFlip()?.flipNext("bottom");
      },
      flipPrev() {
        bookRef.current?.pageFlip()?.flipPrev("bottom");
      },
      turnToPage(pageIndex) {
        bookRef.current?.pageFlip()?.turnToPage(pageIndex);
      },
      flipToPage(pageIndex) {
        bookRef.current?.pageFlip()?.flip(pageIndex, "bottom");
      },
      getCurrentPageIndex() {
        return bookRef.current?.pageFlip()?.getCurrentPageIndex() ?? 0;
      },
    }));

    useEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      const applyMeasure = () => {
        if (flippingRef.current) {
          return;
        }

        const next = measureHost(host, spreadModeRef.current);
        if (!next) {
          return;
        }

        setDims((current) => {
          if (
            current &&
            current.pageWidth === next.pageWidth &&
            current.pageHeight === next.pageHeight
          ) {
            return current;
          }
          return next;
        });
      };

      applyMeasure();
      requestAnimationFrame(applyMeasure);

      const observer = new ResizeObserver(applyMeasure);
      observer.observe(host);
      return () => observer.disconnect();
    }, [spreadMode]);

    useEffect(() => {
      const host = hostRef.current;
      if (!host || !onZoomChangeRef.current) {
        return;
      }

      const handleWheel = (event: WheelEvent) => {
        if (!event.ctrlKey) {
          return;
        }

        event.preventDefault();
        const delta = event.deltaY > 0 ? -READER_ZOOM_STEP : READER_ZOOM_STEP;
        onZoomChangeRef.current?.(clampReaderZoom(zoomRef.current + delta));
      };

      host.addEventListener("wheel", handleWheel, { passive: false });
      return () => host.removeEventListener("wheel", handleWheel);
    }, []);

    useLayoutEffect(() => {
      if (zoom !== READER_ZOOM_MIN) {
        setMinZoomFit(1);
        return;
      }

      const host = hostRef.current;
      if (!host) {
        return;
      }

      setMinZoomFit(measureMinZoomFit(host, baseScale));
    }, [baseScale, dims, pages, zoom]);

    useLayoutEffect(() => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      const prevScale = prevEffectiveScaleRef.current;
      if (prevScale === effectiveScale) {
        return;
      }

      for (const container of host.querySelectorAll<HTMLElement>(".reader-page__text")) {
        if (prevScale > 0) {
          container.scrollTop = container.scrollTop * (effectiveScale / prevScale);
        }

        const maxScroll = container.scrollHeight - container.clientHeight;
        if (maxScroll <= 1) {
          container.scrollTop = 0;
        } else {
          container.scrollTop = Math.min(container.scrollTop, maxScroll);
        }
      }

      prevEffectiveScaleRef.current = effectiveScale;
    }, [effectiveScale]);

    const remeasure = () => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      const next = measureHost(host, spreadModeRef.current);
      if (!next) {
        return;
      }

      setDims((current) => {
        if (
          current &&
          current.pageWidth === next.pageWidth &&
          current.pageHeight === next.pageHeight
        ) {
          return current;
        }
        return next;
      });
    };

    const handleInit = () => {
      requestAnimationFrame(() => {
        bookRef.current?.pageFlip()?.update();
        remeasure();
      });
    };

    const handleFlippingChange = (flipping: boolean) => {
      flippingRef.current = flipping;
      onFlippingChange?.(flipping);
      if (!flipping) {
        remeasure();
      }
    };

    const spreadWidth = dims
      ? spreadMode === "single"
        ? dims.pageWidth
        : dims.pageWidth * 2
      : 0;

    const hostStyle = dims
      ? ({
          "--reader-page-width": `${dims.pageWidth}px`,
          "--reader-page-height": `${dims.pageHeight}px`,
          "--reader-spread-width": `${spreadWidth}px`,
          "--reader-zoom-scale": String(effectiveScale),
        } as CSSProperties)
      : undefined;

    return (
      <div
        ref={hostRef}
        className={`reader-flipbook-host reader-flipbook-host--${spreadMode}${zoom === READER_ZOOM_MIN ? " reader-flipbook-host--zoomed-out-max" : ""}`}
        style={hostStyle}
      >
        <div className={`reader-flipbook-surface reader-flipbook-surface--${spreadMode}`}>
          {spreadMode === "double" ? (
            <div className="reader-flipbook-spine" aria-hidden="true" />
          ) : null}
          {dims ? (
            <HTMLFlipBook
              key={`${spreadMode}-${dims.pageWidth}x${dims.pageHeight}`}
              ref={bookRef}
              className="reader-flipbook"
              style={{}}
              startPage={startPageIndex}
              width={dims.pageWidth}
              height={dims.pageHeight}
              size="fixed"
              minWidth={dims.pageWidth}
              maxWidth={dims.pageWidth}
              minHeight={dims.pageHeight}
              maxHeight={dims.pageHeight}
              drawShadow
              flippingTime={900}
              usePortrait={spreadMode === "single"}
              startZIndex={0}
              autoSize={false}
              maxShadowOpacity={0.55}
              showCover={false}
              mobileScrollSupport
              clickEventForward
              useMouseEvents
              swipeDistance={30}
              showPageCorners
              disableFlipByClick={false}
              onInit={handleInit}
              onFlip={(event) => onFlip?.(event.data as number)}
              onChangeState={(event) => handleFlippingChange(event.data === "flipping")}
            >
              {pages.map((page) => (
                <FlipbookPage
                  key={page.pageNumber}
                  pageNumber={page.pageNumber}
                  content={page.content}
                />
              ))}
            </HTMLFlipBook>
          ) : null}
        </div>
      </div>
    );
  },
);

interface PageFlipApi {
  flipNext(corner: "top" | "bottom"): void;
  flipPrev(corner: "top" | "bottom"): void;
  flip(pageIndex: number, corner: "top" | "bottom"): void;
  turnToPage(pageIndex: number): void;
  getCurrentPageIndex(): number;
  update(): void;
}

const FlipbookPage = forwardRef<
  HTMLDivElement,
  {
    pageNumber: number;
    content: string;
  }
>(function FlipbookPage({ pageNumber, content }, ref) {
  const html = isHtmlContent(content);

  return (
    <div ref={ref} className="reader-flipbook-page" data-flipbook-page={pageNumber}>
      <article className="reader-page">
        <span className="reader-page__label">Page {pageNumber}</span>
        <div className="reader-page__body">
          <div data-page={pageNumber} className="reader-page__text">
            {html ? (
              <div
                className="reader-page__text-inner tiptap"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            ) : (
              <div className="reader-page__text-inner tiptap">{content}</div>
            )}
          </div>
        </div>
      </article>
    </div>
  );
});
