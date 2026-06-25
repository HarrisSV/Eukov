"use client";

import {
  DocxEditor,
  createEmptyDocument,
  type DocxEditorRef,
} from "@eigenpal/docx-editor-react";
import "@eigenpal/docx-editor-react/styles.css";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  arrayBufferToBase64,
  base64ToArrayBufferAsync,
  htmlToDocxBuffer,
  isEmptyHtmlContent,
  normalizeEditorContent,
  tryDocxBufferToReaderHtml,
  type DocumentContentFormat,
} from "@/lib/docx-content";
import {
  migrationCacheKey,
  readCachedDocx,
  writeCachedDocx,
} from "@/lib/docx-migration-cache";
import { classifyImportFile, textFileToHtml } from "@/lib/document-import";
import { scheduleChapterHeadingStyles } from "@/lib/chapter-heading-styles";
import { prepareStructuredPasteHtml, shouldEnhancePaste } from "@/lib/paste-html";
import { LoadingBuffer } from "@/components/ui/LoadingBuffer";
import "./draft-editor.css";

function resolveInitialPrepareState(
  content: string,
  contentFormat: DocumentContentFormat,
): "loading" | "migrating" | null {
  if (!content) {
    return null;
  }
  const normalized = normalizeEditorContent(content, contentFormat);
  if (
    normalized.contentFormat === "html" &&
    normalized.content &&
    !isEmptyHtmlContent(normalized.content)
  ) {
    return "migrating";
  }
  if (normalized.contentFormat === "docx" && normalized.content) {
    return "loading";
  }
  return null;
}

function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}

export type DraftDocumentPayload = {
  content: string;
  contentFormat: DocumentContentFormat;
  readerHtml?: string;
};

export type DraftEditorHandle = {
  getDocumentPayload: () => Promise<DraftDocumentPayload | null>;
};

interface DraftEditorProps {
  content: string;
  contentFormat?: DocumentContentFormat;
  documentId?: string;
  onChange?: (payload: DraftDocumentPayload) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const DraftEditor = forwardRef<DraftEditorHandle, DraftEditorProps>(
  function DraftEditor(
    {
      content,
      contentFormat = "docx",
      documentId,
      onChange,
      disabled = false,
      placeholder = "Start writing or import a document...",
    },
    ref,
  ) {
    const editorRef = useRef<DocxEditorRef>(null);
    const onChangeRef = useRef(onChange);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const loadIdRef = useRef(0);
    const hasContentToPrepare = Boolean(content);
    const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null | undefined>(
      hasContentToPrepare ? undefined : null,
    );
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadWarning, setLoadWarning] = useState<string | null>(null);
    const [prepareState, setPrepareState] = useState<"loading" | "migrating" | null>(() =>
      hasContentToPrepare ? resolveInitialPrepareState(content, contentFormat) : null,
    );
    const [importing, setImporting] = useState(false);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
      const loadId = ++loadIdRef.current;
      let cancelled = false;
      const isActive = () => !cancelled && loadId === loadIdRef.current;

      async function loadInitialDocument() {
        setLoadError(null);
        setLoadWarning(null);
        setDocumentBuffer(undefined);

        const normalized = normalizeEditorContent(content, contentFormat);
        const needsPrepare =
          (normalized.contentFormat === "docx" && Boolean(normalized.content)) ||
          (normalized.contentFormat === "html" &&
            Boolean(normalized.content) &&
            !isEmptyHtmlContent(normalized.content));

        if (needsPrepare) {
          setPrepareState(
            normalized.contentFormat === "html" ? "migrating" : "loading",
          );
          await yieldToPaint();
        } else {
          setPrepareState(null);
        }

        try {
          if (normalized.contentFormat === "docx" && normalized.content) {
            const buffer = await base64ToArrayBufferAsync(normalized.content);
            if (isActive()) {
              setDocumentBuffer(buffer);
            }
            return;
          }

          if (
            normalized.contentFormat === "html" &&
            normalized.content &&
            !isEmptyHtmlContent(normalized.content)
          ) {
            try {
              const cacheKey = migrationCacheKey(documentId);
              let migrated = cacheKey ? await readCachedDocx(cacheKey) : null;
              if (!migrated) {
                migrated = await htmlToDocxBuffer(normalized.content);
                if (cacheKey) {
                  void writeCachedDocx(cacheKey, migrated);
                }
              }
              if (isActive()) {
                setDocumentBuffer(migrated);
                onChangeRef.current?.({
                  content: arrayBufferToBase64(migrated),
                  contentFormat: "docx",
                  readerHtml: normalized.content,
                });
              }
            } catch {
              if (isActive()) {
                setDocumentBuffer(null);
                setLoadWarning(
                  "Could not convert your previous draft into Word format. Starting with a blank document.",
                );
              }
            }
            return;
          }

          if (isActive()) {
            setDocumentBuffer(null);
          }
        } catch (error) {
          if (isActive()) {
            setLoadError(
              error instanceof Error ? error.message : "Could not load the document.",
            );
            setDocumentBuffer(null);
          }
        } finally {
          if (isActive()) {
            setPrepareState(null);
          }
        }
      }

      void loadInitialDocument();
      return () => {
        cancelled = true;
      };
    }, [content, contentFormat, documentId]);

    const buildPayload = useCallback(async (): Promise<DraftDocumentPayload | null> => {
      const buffer = await editorRef.current?.save();
      if (!buffer) {
        return null;
      }

      const payload: DraftDocumentPayload = {
        content: arrayBufferToBase64(buffer),
        contentFormat: "docx",
      };

      const readerHtml = await tryDocxBufferToReaderHtml(buffer);
      if (readerHtml) {
        payload.readerHtml = readerHtml;
      }

      return payload;
    }, []);

    const buildCheckpointPayload = useCallback(async (): Promise<DraftDocumentPayload | null> => {
      const buffer = await editorRef.current?.save();
      if (!buffer) {
        return null;
      }
      return {
        content: arrayBufferToBase64(buffer),
        contentFormat: "docx",
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getDocumentPayload: buildPayload,
      }),
      [buildPayload],
    );

    const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const persistCheckpoint = useCallback(async () => {
      const payload = await buildCheckpointPayload();
      if (payload) {
        onChangeRef.current?.(payload);
      }
    }, [buildCheckpointPayload]);

    const scheduleCheckpoint = useCallback(() => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
      persistTimerRef.current = setTimeout(() => {
        void persistCheckpoint();
      }, 2000);
    }, [persistCheckpoint]);

    useEffect(() => {
      return () => {
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current);
        }
      };
    }, []);

    useEffect(() => {
      if (disabled) {
        return;
      }

      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      const onPasteCapture = (event: ClipboardEvent) => {
        if (!shouldEnhancePaste(event) || !event.clipboardData) {
          return;
        }

        const html = event.clipboardData.getData("text/html");
        const plain = event.clipboardData.getData("text/plain");
        const structured = prepareStructuredPasteHtml(html, plain);
        if (!structured) {
          return;
        }

        event.clipboardData.setData("text/html", structured);
      };

      surface.addEventListener("paste", onPasteCapture, true);
      return () => {
        surface.removeEventListener("paste", onPasteCapture, true);
      };
    }, [disabled]);

    const handlePaste = useCallback(() => {
      scheduleChapterHeadingStyles(editorRef);
    }, []);

    useEffect(() => {
      if (documentBuffer === undefined || prepareState !== null) {
        return;
      }
      scheduleChapterHeadingStyles(editorRef);
    }, [documentBuffer, prepareState]);

    const isPreparing = prepareState !== null || documentBuffer === undefined;
    const prepareTitle =
      prepareState === "migrating"
        ? "Upgrading draft to Word format…"
        : "Loading manuscript…";
    const prepareDetail =
      prepareState === "migrating"
        ? "Large scripts are converted in the background. This can take a minute."
        : "Preparing your document for the editor.";

    const editorLoadingIndicator = (
      <LoadingBuffer
        title="Opening document in editor…"
        detail="Large manuscripts can take a moment to render."
        className="draft-editor__buffer"
      />
    );

    if (isPreparing) {
      return (
        <div className="draft-editor">
          <div className="draft-editor__surface draft-editor__surface--loading">
            <LoadingBuffer title={prepareTitle} detail={prepareDetail} />
          </div>
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="draft-editor">
          <div className="draft-editor__surface p-4 text-sm text-danger" role="alert">
            {loadError}
          </div>
        </div>
      );
    }

    return (
      <div className={`draft-editor${disabled ? " draft-editor--readonly" : ""}`}>
        {loadWarning ? (
          <p className="draft-editor__notice text-sm text-muted" role="status">
            {loadWarning}
          </p>
        ) : null}
        <div className="draft-editor__surface" ref={surfaceRef}>
          {importing ? (
            <div className="draft-editor__import-overlay">
              <LoadingBuffer
                title="Importing document…"
                detail="Converting your file for the editor. Large scripts can take a minute."
              />
            </div>
          ) : null}
          <DocxEditor
            ref={editorRef}
            documentBuffer={documentBuffer}
            document={documentBuffer ? undefined : createEmptyDocument()}
            mode={disabled ? "viewing" : "editing"}
            readOnly={disabled}
            showToolbar={!disabled}
            showFileOpen={!disabled}
            showHelpMenu={!disabled}
            showZoomControl
            documentNameEditable={false}
            placeholder={placeholder}
            className="draft-editor__docx"
            loadingIndicator={editorLoadingIndicator}
            onError={(error) => {
              setLoadError(error.message);
            }}
            onChange={() => {
              scheduleCheckpoint();
            }}
            onPaste={handlePaste}
            onSave={(buffer) => {
              onChangeRef.current?.({
                content: arrayBufferToBase64(buffer),
                contentFormat: "docx",
              });
            }}
            onOpen={async (file) => {
              setImporting(true);
              try {
                const kind = classifyImportFile(file);
                let buffer: ArrayBuffer;
                let readerHtml: string | undefined;

                if (kind === "text" || kind === "markdown" || kind === "csv") {
                  const html = await textFileToHtml(file);
                  buffer = await htmlToDocxBuffer(html);
                  readerHtml = html;
                } else {
                  buffer = await file.arrayBuffer();
                }

                setDocumentBuffer(buffer);
                onChangeRef.current?.({
                  content: arrayBufferToBase64(buffer),
                  contentFormat: "docx",
                  readerHtml,
                });
                scheduleChapterHeadingStyles(editorRef);
              } finally {
                setImporting(false);
              }
            }}
          />
        </div>
      </div>
    );
  },
);
