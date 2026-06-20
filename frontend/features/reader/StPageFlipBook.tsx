"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from "react";
import { isHtmlContent } from "@/features/reader/page-content";

const HTMLFlipBook = dynamic(() => import("react-pageflip"), { ssr: false });

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
  onFlip?: (pageIndex: number) => void;
  onFlippingChange?: (flipping: boolean) => void;
}

interface BookDimensions {
  pageWidth: number;
  pageHeight: number;
}

const MIN_HOST = { width: 120, height: 120 };

function measureHost(host: HTMLElement): BookDimensions | null {
  const width = Math.floor(host.clientWidth);
  const height = Math.floor(host.clientHeight);
  if (width < MIN_HOST.width || height < MIN_HOST.height) {
    return null;
  }

  return {
    pageWidth: Math.max(160, Math.floor(width / 2)),
    pageHeight: Math.max(220, height),
  };
}

export const StPageFlipBook = forwardRef<StPageFlipBookHandle, StPageFlipBookProps>(
  function StPageFlipBook({ pages, startPageIndex, onFlip, onFlippingChange }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const bookRef = useRef<{ pageFlip(): PageFlipApi } | null>(null);
    const flippingRef = useRef(false);
    const [dims, setDims] = useState<BookDimensions | null>(null);

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

        const next = measureHost(host);
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
    }, []);

    const remeasure = () => {
      const host = hostRef.current;
      if (!host) {
        return;
      }

      const next = measureHost(host);
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

    const hostStyle = dims
      ? ({
          "--reader-page-width": `${dims.pageWidth}px`,
          "--reader-page-height": `${dims.pageHeight}px`,
          "--reader-spread-width": `${dims.pageWidth * 2}px`,
        } as CSSProperties)
      : undefined;

    return (
      <div ref={hostRef} className="reader-flipbook-host" style={hostStyle}>
        <div className="reader-flipbook-spine" aria-hidden="true" />
        {dims ? (
          <HTMLFlipBook
            key={`${dims.pageWidth}x${dims.pageHeight}`}
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
            usePortrait={false}
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
          {html ? (
            <div
              data-page={pageNumber}
              className="reader-page__text tiptap"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <div data-page={pageNumber} className="reader-page__text tiptap">
              {content}
            </div>
          )}
        </div>
      </article>
    </div>
  );
});
