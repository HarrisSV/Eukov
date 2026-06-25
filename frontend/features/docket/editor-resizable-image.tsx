"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  fitImageDimensions,
  measureEditorContentMaxWidth,
} from "@/lib/image-fit";
import { EDITOR_PAGE_CONTENT_HEIGHT_PX } from "@/lib/editor-page-layout";
import {
  commitWordLikeResize,
  IMAGE_MIN_SIZE,
  isCornerDirection,
  rotationOnlyTransform,
} from "@/features/docket/editor-image-resize";
import { useCallback, useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import type {
  OnDrag,
  OnDragEnd,
  OnResize,
  OnResizeEnd,
  OnResizeStart,
  OnRotate,
  OnRotateEnd,
} from "react-moveable";

function readEditorZoom(element: HTMLElement | null): number {
  const host = element?.closest(".draft-editor__content");
  if (!host) {
    return 1;
  }

  const zoom = Number.parseFloat(getComputedStyle(host).zoom || "1");
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function parseSize(value: string | number | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function scheduleMoveableUpdate(moveable: Moveable | null) {
  if (!moveable) {
    return;
  }

  requestAnimationFrame(() => {
    moveable.updateRect();
  });
}

function deferUpdateAttributes(
  updateAttributes: NodeViewProps["updateAttributes"],
  attrs: Record<string, unknown>,
) {
  queueMicrotask(() => {
    updateAttributes(attrs);
  });
}

export function ResizableImageView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const moveableRef = useRef<Moveable>(null);
  const naturalSizeRef = useRef<{ width: number; height: number } | null>(null);
  const initializedRef = useRef(false);
  const resizeSessionRef = useRef({
    width: IMAGE_MIN_SIZE,
    height: IMAGE_MIN_SIZE,
    posX: 0,
    posY: 0,
  });
  const resizeDirectionRef = useRef<number[]>([0, 1]);
  const isResizingRef = useRef(false);
  const isRotatingRef = useRef(false);
  const isDraggingRef = useRef(false);

  const {
    src,
    alt,
    width,
    height,
    rotation = 0,
    naturalWidth,
    naturalHeight,
    posX,
    posY,
    marginLeft,
    marginTop,
    offsetX,
    offsetY,
  } = node.attrs as {
    src: string;
    alt?: string;
    width?: number | string | null;
    height?: number | string | null;
    rotation?: number;
    naturalWidth?: number | string | null;
    naturalHeight?: number | string | null;
    posX?: number | string | null;
    posY?: number | string | null;
    marginLeft?: number | string | null;
    marginTop?: number | string | null;
    offsetX?: number | string | null;
    offsetY?: number | string | null;
  };

  const storedWidth = parseSize(width);
  const storedHeight = parseSize(height);
  const storedNaturalWidth = parseSize(naturalWidth);
  const storedNaturalHeight = parseSize(naturalHeight);
  const storedRotation = parseSize(rotation) ?? 0;
  const storedPosX =
    parseSize(posX) ?? parseSize(marginLeft) ?? parseSize(offsetX) ?? 0;
  const storedPosY =
    parseSize(posY) ?? parseSize(marginTop) ?? parseSize(offsetY) ?? 0;

  const [keepRatio, setKeepRatio] = useState(false);
  const [moveableReady, setMoveableReady] = useState(false);

  const getMaxBounds = useCallback(() => {
    const pageSheet =
      (wrapperRef.current?.closest(".draft-page-sheet") as HTMLElement | null) ??
      (editor.view.dom.querySelector(".draft-page-sheet") as HTMLElement | null) ??
      wrapperRef.current;

    return {
      maxWidth: measureEditorContentMaxWidth(pageSheet),
      maxHeight: EDITOR_PAGE_CONTENT_HEIGHT_PX,
    };
  }, [editor.view.dom]);

  const getNaturalSize = useCallback(() => {
    if (storedNaturalWidth && storedNaturalHeight) {
      return { width: storedNaturalWidth, height: storedNaturalHeight };
    }
    if (naturalSizeRef.current) {
      return naturalSizeRef.current;
    }
    const img = targetRef.current?.querySelector("img");
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      return { width: img.naturalWidth, height: img.naturalHeight };
    }
    if (storedWidth && storedHeight) {
      return { width: storedWidth, height: storedHeight };
    }
    return { width: IMAGE_MIN_SIZE, height: IMAGE_MIN_SIZE };
  }, [storedHeight, storedNaturalHeight, storedNaturalWidth, storedWidth]);

  const resolveDisplaySize = useCallback(() => {
    const { maxWidth, maxHeight } = getMaxBounds();

    if (storedWidth == null || storedHeight == null) {
      const natural = getNaturalSize();
      return fitImageDimensions(natural.width, natural.height, maxWidth, maxHeight);
    }

    return {
      width: Math.max(IMAGE_MIN_SIZE, storedWidth),
      height: Math.max(IMAGE_MIN_SIZE, storedHeight),
    };
  }, [getMaxBounds, getNaturalSize, storedHeight, storedWidth]);

  const displaySize = resolveDisplaySize();
  const editorZoom = readEditorZoom(wrapperRef.current);
  const flowHeight = storedPosY + displaySize.height;

  const paintTarget = useCallback(
    (
      nextWidth: number,
      nextHeight: number,
      nextRotation: number,
      nextPosX: number,
      nextPosY: number,
    ) => {
      const target = targetRef.current;
      const wrapper = wrapperRef.current;
      if (!target || !wrapper) {
        return;
      }

      target.style.width = `${nextWidth}px`;
      target.style.height = `${nextHeight}px`;
      target.style.left = `${nextPosX}px`;
      target.style.top = `${nextPosY}px`;
      target.style.transform = rotationOnlyTransform(nextRotation);
      wrapper.style.minHeight = `${nextPosY + nextHeight}px`;
    },
    [],
  );

  useEffect(() => {
    initializedRef.current = false;
    naturalSizeRef.current = null;
    setMoveableReady(false);
  }, [src]);

  useEffect(() => {
    const img = targetRef.current?.querySelector("img");
    if (!img || initializedRef.current) {
      return;
    }

    const initFromImage = () => {
      if (initializedRef.current || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        return;
      }

      initializedRef.current = true;
      naturalSizeRef.current = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };

      if (storedWidth != null && storedHeight != null) {
        if (storedNaturalWidth !== img.naturalWidth || storedNaturalHeight !== img.naturalHeight) {
          deferUpdateAttributes(updateAttributes, {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
          });
        }
        return;
      }

      const { maxWidth, maxHeight } = getMaxBounds();
      const fitted = fitImageDimensions(
        img.naturalWidth,
        img.naturalHeight,
        maxWidth,
        maxHeight,
      );

      deferUpdateAttributes(updateAttributes, {
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        width: fitted.width,
        height: fitted.height,
        posX: 0,
        posY: 0,
        marginLeft: 0,
        marginTop: 0,
        offsetX: 0,
        offsetY: 0,
      });
    };

    if (img.complete) {
      initFromImage();
    } else {
      img.addEventListener("load", initFromImage, { once: true });
    }
  }, [getMaxBounds, src, storedHeight, storedNaturalHeight, storedNaturalWidth, storedWidth, updateAttributes]);

  useEffect(() => {
    if (isResizingRef.current || isRotatingRef.current || isDraggingRef.current) {
      return;
    }

    paintTarget(
      displaySize.width,
      displaySize.height,
      storedRotation,
      storedPosX,
      storedPosY,
    );
    scheduleMoveableUpdate(moveableRef.current);
  }, [
    displaySize.height,
    displaySize.width,
    paintTarget,
    storedPosX,
    storedPosY,
    storedRotation,
  ]);

  useEffect(() => {
    setMoveableReady(Boolean(selected && editor.isEditable && targetRef.current));
  }, [editor.isEditable, selected, displaySize.width, displaySize.height]);

  useEffect(() => {
    if (!moveableReady) {
      return;
    }

    scheduleMoveableUpdate(moveableRef.current);
  }, [moveableReady, editorZoom, storedPosX, storedPosY, flowHeight]);

  const onDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const onDrag = useCallback((event: OnDrag) => {
    const { maxWidth, maxHeight } = getMaxBounds();
    const nextLeft = Math.max(0, Math.min(event.left, maxWidth - displaySize.width));
    const nextTop = Math.max(0, Math.min(event.top, maxHeight - displaySize.height));

    event.target.style.left = `${nextLeft}px`;
    event.target.style.top = `${nextTop}px`;

    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.style.minHeight = `${nextTop + displaySize.height}px`;
    }
  }, [displaySize.height, displaySize.width, getMaxBounds]);

  const onDragEnd = useCallback(
    (event: OnDragEnd) => {
      isDraggingRef.current = false;

      const lastEvent = event.lastEvent;
      if (!lastEvent) {
        return;
      }

      const { maxWidth, maxHeight } = getMaxBounds();
      const nextPosX = Math.round(
        Math.max(0, Math.min(lastEvent.left, maxWidth - displaySize.width)),
      );
      const nextPosY = Math.round(
        Math.max(0, Math.min(lastEvent.top, maxHeight - displaySize.height)),
      );

      paintTarget(displaySize.width, displaySize.height, storedRotation, nextPosX, nextPosY);

      updateAttributes({
        posX: nextPosX,
        posY: nextPosY,
        marginLeft: 0,
        marginTop: 0,
        offsetX: 0,
        offsetY: 0,
      });

      scheduleMoveableUpdate(moveableRef.current);
    },
    [
      displaySize.height,
      displaySize.width,
      getMaxBounds,
      paintTarget,
      storedRotation,
      updateAttributes,
    ],
  );

  const onResizeStart = useCallback(
    (event: OnResizeStart) => {
      isResizingRef.current = true;
      resizeDirectionRef.current = event.direction;
      setKeepRatio(isCornerDirection(event.direction));
      resizeSessionRef.current = {
        width: displaySize.width,
        height: displaySize.height,
        posX: storedPosX,
        posY: storedPosY,
      };
    },
    [displaySize.height, displaySize.width, storedPosX, storedPosY],
  );

  const onResize = useCallback((event: OnResize) => {
    event.target.style.width = `${Math.max(IMAGE_MIN_SIZE, event.width)}px`;
    event.target.style.height = `${Math.max(IMAGE_MIN_SIZE, event.height)}px`;
    event.target.style.transform = event.drag.transform;

    const wrapper = wrapperRef.current;
    if (wrapper) {
      const top = Number.parseFloat(event.target.style.top || "0");
      wrapper.style.minHeight = `${top + Math.max(IMAGE_MIN_SIZE, event.height)}px`;
    }
  }, []);

  const onResizeEnd = useCallback(
    (event: OnResizeEnd) => {
      setKeepRatio(false);

      const lastEvent = event.lastEvent;
      if (!lastEvent) {
        isResizingRef.current = false;
        return;
      }

      const { maxWidth, maxHeight } = getMaxBounds();
      const natural = getNaturalSize();
      const direction = lastEvent.direction ?? resizeDirectionRef.current;
      const [translateX, translateY] = lastEvent.drag.beforeTranslate;

      const committed = commitWordLikeResize({
        direction,
        width: Math.max(IMAGE_MIN_SIZE, lastEvent.width),
        height: Math.max(IMAGE_MIN_SIZE, lastEvent.height),
        translateX,
        translateY,
        base: resizeSessionRef.current,
        naturalWidth: natural.width,
        naturalHeight: natural.height,
        maxWidth,
        maxHeight,
      });

      paintTarget(
        committed.width,
        committed.height,
        storedRotation,
        committed.posX,
        committed.posY,
      );

      updateAttributes({
        width: committed.width,
        height: committed.height,
        posX: committed.posX,
        posY: committed.posY,
        marginLeft: 0,
        marginTop: 0,
        offsetX: 0,
        offsetY: 0,
      });

      isResizingRef.current = false;
      scheduleMoveableUpdate(moveableRef.current);
    },
    [getMaxBounds, getNaturalSize, paintTarget, storedRotation, updateAttributes],
  );

  const onRotateStart = useCallback(() => {
    isRotatingRef.current = true;
  }, []);

  const onRotate = useCallback((event: OnRotate) => {
    event.target.style.transform = event.drag.transform;
  }, []);

  const onRotateEnd = useCallback(
    (event: OnRotateEnd) => {
      isRotatingRef.current = false;

      const lastEvent = event.lastEvent;
      if (!lastEvent) {
        return;
      }

      const nextRotation = Math.round(lastEvent.rotation);
      paintTarget(
        displaySize.width,
        displaySize.height,
        nextRotation,
        storedPosX,
        storedPosY,
      );

      updateAttributes({ rotation: nextRotation });
      scheduleMoveableUpdate(moveableRef.current);
    },
    [
      displaySize.height,
      displaySize.width,
      paintTarget,
      storedPosX,
      storedPosY,
      updateAttributes,
    ],
  );

  const { maxWidth, maxHeight } = getMaxBounds();
  const dragBounds = {
    left: 0,
    top: 0,
    right: Math.max(0, maxWidth - displaySize.width),
    bottom: Math.max(0, maxHeight - displaySize.height),
  };

  return (
    <NodeViewWrapper
      as="div"
      className="editor-image-block"
      ref={wrapperRef}
      style={{ minHeight: `${flowHeight}px` }}
    >
      <div
        ref={targetRef}
        className={`editor-image-view${selected ? " editor-image-view--selected" : ""}`}
        style={{
          width: `${displaySize.width}px`,
          height: `${displaySize.height}px`,
          left: `${storedPosX}px`,
          top: `${storedPosY}px`,
          transform: rotationOnlyTransform(storedRotation),
        }}
      >
        <img
          src={src}
          alt={alt ?? ""}
          draggable={false}
          className="editor-image-view__img"
          width={displaySize.width}
          height={displaySize.height}
        />
      </div>

      {moveableReady && targetRef.current ? (
        <Moveable
          ref={moveableRef}
          target={targetRef}
          origin={false}
          draggable={editor.isEditable}
          resizable={editor.isEditable}
          rotatable={editor.isEditable}
          keepRatio={keepRatio}
          zoom={editorZoom}
          throttleResize={0}
          bounds={dragBounds}
          renderDirections={["nw", "n", "ne", "w", "e", "sw", "s", "se"]}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onResizeStart={onResizeStart}
          onResize={onResize}
          onResizeEnd={onResizeEnd}
          onRotateStart={onRotateStart}
          onRotate={onRotate}
          onRotateEnd={onRotateEnd}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
