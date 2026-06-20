"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import {
  IMPORT_ACCEPT,
  importFileOnClient,
} from "@/lib/document-import";
import {
  isGoogleDriveConfigured,
  importFromGoogleDrive,
} from "@/features/docket/google-drive-import";
import {
  DEFAULT_FONT_SIZE,
  FONT_FAMILIES,
  FONT_SIZE_POINTS,
  matchFontValue,
  pxToPoints,
  sizeToPx,
} from "@/features/docket/editor-config";
import {
  PageBreak,
  PageNumber,
  SectionBreak,
} from "@/features/docket/editor-page-extensions";
import { PageSheet } from "@/features/docket/editor-page-sheet";
import {
  ensurePaginatedHtml,
  mergeAndPaginateHtml,
  plainTextToPaginatedHtml,
  WORDS_PER_PAGE,
} from "@/lib/paginate-html";
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
} from "@/features/docket/editor-align-icons";
import "./draft-editor.css";

type TextAlignValue = "left" | "center" | "right" | "justify";

/** Visual zoom for the document surface (does not change saved content). */
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;
const ZOOM_DEFAULT = 100;

function getActiveTextAlign(editor: Editor): TextAlignValue {
  if (editor.isActive("heading")) {
    return (editor.getAttributes("heading").textAlign as TextAlignValue) || "left";
  }
  if (editor.isActive("paragraph")) {
    return (editor.getAttributes("paragraph").textAlign as TextAlignValue) || "left";
  }

  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "heading" || node.type.name === "paragraph") {
      return (node.attrs.textAlign as TextAlignValue) || "left";
    }
  }

  return "left";
}

function setBlockAlignment(editor: Editor, alignment: TextAlignValue) {
  editor.chain().focus().setTextAlign(alignment).run();
}

function keepFocus(e: React.MouseEvent) {
  e.preventDefault();
}

function applyTextStyle(
  editor: Editor,
  apply: (chain: ReturnType<Editor["chain"]>) => ReturnType<ReturnType<Editor["chain"]>["run"]>,
) {
  const { empty } = editor.state.selection;
  let chain = editor.chain().focus();
  if (!empty) {
    chain = chain.extendMarkRange("textStyle");
  }
  return apply(chain);
}

function useToolbarSync(editor: Editor | null) {
  const [, bump] = useState(0);
  const historyState = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) {
        return { canUndo: false, canRedo: false };
      }
      return {
        canUndo: ed.can().undo(),
        canRedo: ed.can().redo(),
      };
    },
  });

  useEffect(() => {
    if (!editor) return;
    const refresh = () => bump((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  if (!editor) {
    return {
      fontFamily: "",
      fontSize: DEFAULT_FONT_SIZE,
      align: "left" as TextAlignValue,
      alignLeft: true,
      alignCenter: false,
      alignRight: false,
      alignJustify: false,
      canUndo: false,
      canRedo: false,
    };
  }

  const textStyle = editor.getAttributes("textStyle") as { fontFamily?: string; fontSize?: string };
  const align = getActiveTextAlign(editor);

  return {
    fontFamily: matchFontValue(textStyle.fontFamily),
    fontSize: pxToPoints(textStyle.fontSize),
    align,
    alignLeft: align === "left",
    alignCenter: align === "center",
    alignRight: align === "right",
    alignJustify: align === "justify",
    canUndo: historyState?.canUndo ?? false,
    canRedo: historyState?.canRedo ?? false,
  };
}

interface DraftEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export type DraftEditorHandle = {
  getContent: () => string;
};

export const DraftEditor = forwardRef<DraftEditorHandle, DraftEditorProps>(
  function DraftEditor(
    {
      content,
      onChange,
      disabled = false,
      placeholder = "Start writing or import a document...",
    },
    ref,
  ) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const lastHtmlFromEditor = useRef("");
  const initialContentRef = useRef(ensurePaginatedHtml(content || "<p></p>"));
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [pageView, setPageView] = useState(true);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        trailingNode: false,
        underline: false,
        link: false,
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ allowBase64: true }),
      PageSheet,
      PageBreak,
      SectionBreak,
      PageNumber,
    ],
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContentRef.current,
      editable: !disabled,
      immediatelyRender: false,
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        lastHtmlFromEditor.current = html;
        onChangeRef.current(html);
      },
      editorProps: {
        attributes: {
          class: "tiptap",
          "aria-label": "Draft editor",
          spellcheck: "true",
        },
      },
    },
    [],
  );

  const toolbar = useToolbarSync(editor);

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => editor?.getHTML() ?? lastHtmlFromEditor.current ?? content,
    }),
    [editor, content],
  );

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || disabled) return;

    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain") ?? "";
      const pastedWords = text.split(/\s+/).filter(Boolean).length;
      if (pastedWords < WORDS_PER_PAGE / 4) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const pastedHtml =
        event.clipboardData?.getData("text/html") ||
        plainTextToPaginatedHtml(text);

      const currentHtml = editor.getHTML();
      const paginated = editor.isEmpty
        ? ensurePaginatedHtml(pastedHtml)
        : mergeAndPaginateHtml(currentHtml, pastedHtml);

      editor.commands.setContent(paginated);
      lastHtmlFromEditor.current = paginated;
      onChangeRef.current(paginated);
    };

    const dom = editor.view.dom;
    dom.addEventListener("paste", onPaste, true);
    return () => dom.removeEventListener("paste", onPaste, true);
  }, [editor, disabled]);

  const applyImportedHtml = useCallback(
    (html: string) => {
      if (!editor) return;
      const paginated = ensurePaginatedHtml(html);
      editor.commands.setContent(paginated || "<p></p>");
      lastHtmlFromEditor.current = editor.getHTML();
      onChangeRef.current(lastHtmlFromEditor.current);
    },
    [editor],
  );

  const importLocalFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setImportError(null);
      setImporting(true);
      try {
        const html = await importFileOnClient(file);
        applyImportedHtml(html);
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Could not import this file.",
        );
      } finally {
        setImporting(false);
      }
    },
    [editor, applyImportedHtml],
  );

  const importCloudFile = useCallback(async () => {
    if (!editor) return;
    setImportError(null);

    if (!isGoogleDriveConfigured()) {
      setImportError(
        "Google Drive is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_API_KEY to your .env file, then restart the frontend.",
      );
      return;
    }

    setImporting(true);
    try {
      const html = await importFromGoogleDrive();
      applyImportedHtml(html);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cloud import failed.";
      if (!/cancel/i.test(message)) {
        setImportError(message);
      }
    } finally {
      setImporting(false);
    }
  }, [editor, applyImportedHtml]);

  const onFilePicked = (file: File | undefined) => {
    if (file) void importLocalFile(file);
  };

  if (!editor) {
    return (
      <div className="draft-editor">
        <div className="draft-editor__surface p-4 text-sm text-muted">Loading editor...</div>
      </div>
    );
  }

  return (
    <div
      className={`draft-editor${disabled ? " draft-editor--readonly" : ""}${pageView ? " draft-editor--page-view" : ""}`}
    >
      {!disabled && (
        <div className="draft-editor__toolbar" role="toolbar" aria-label="Formatting toolbar">
          <div className="draft-editor__group" role="group" aria-label="Text style">
            <RibbonButton
              label="Bold"
              className="draft-editor__btn--bold"
              active={editor.isActive("bold")}
              onAction={() => editor.chain().focus().toggleBold().run()}
            >
              B
            </RibbonButton>
            <RibbonButton
              label="Italic"
              className="draft-editor__btn--italic"
              active={editor.isActive("italic")}
              onAction={() => editor.chain().focus().toggleItalic().run()}
            >
              I
            </RibbonButton>
            <RibbonButton
              label="Underline"
              className="draft-editor__btn--underline"
              active={editor.isActive("underline")}
              onAction={() => editor.chain().focus().toggleUnderline().run()}
            >
              U
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group" role="group" aria-label="Structure">
            {([1, 2, 3, 4, 5, 6] as const).map((level) => (
              <RibbonButton
                key={level}
                label={`Heading ${level}`}
                active={editor.isActive("heading", { level })}
                onAction={() =>
                  editor.chain().focus().toggleHeading({ level }).run()
                }
              >
                H{level}
              </RibbonButton>
            ))}
            <RibbonButton
              label="Bullet list"
              active={editor.isActive("bulletList")}
              onAction={() => editor.chain().focus().toggleBulletList().run()}
            >
              • List
            </RibbonButton>
            <RibbonButton
              label="Numbered list"
              active={editor.isActive("orderedList")}
              onAction={() => editor.chain().focus().toggleOrderedList().run()}
            >
              1. List
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group draft-editor__align-group" role="group" aria-label="Alignment">
            <AlignButton
              label="Align left"
              active={toolbar.alignLeft}
              onAction={() => setBlockAlignment(editor, "left")}
            >
              <AlignLeftIcon />
            </AlignButton>
            <AlignButton
              label="Align center"
              active={toolbar.alignCenter}
              onAction={() => setBlockAlignment(editor, "center")}
            >
              <AlignCenterIcon />
            </AlignButton>
            <AlignButton
              label="Align right"
              active={toolbar.alignRight}
              onAction={() => setBlockAlignment(editor, "right")}
            >
              <AlignRightIcon />
            </AlignButton>
            <AlignButton
              label="Justify"
              active={toolbar.alignJustify}
              onAction={() => setBlockAlignment(editor, "justify")}
            >
              <AlignJustifyIcon />
            </AlignButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group" role="group" aria-label="Font">
            <label className="draft-editor__select-wrap">
              Font
              <select
                className="draft-editor__select"
                value={toolbar.fontFamily}
                onChange={(e) => {
                  const value = e.target.value;
                  applyTextStyle(editor, (chain) =>
                    value ? chain.setFontFamily(value).run() : chain.unsetFontFamily().run(),
                  );
                }}
                aria-label="Font family"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value} style={{ fontFamily: f.value || "inherit" }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="draft-editor__select-wrap">
              Size
              <select
                className="draft-editor__select draft-editor__select--size"
                value={String(toolbar.fontSize)}
                onChange={(e) => {
                  const points = Number(e.target.value);
                  applyTextStyle(editor, (chain) =>
                    chain.setFontSize(sizeToPx(points)).run(),
                  );
                }}
                aria-label="Font size"
              >
                {FONT_SIZE_POINTS.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group" role="group" aria-label="Page layout">
            <RibbonButton
              label="Toggle page layout view"
              active={pageView}
              onAction={() => setPageView((v) => !v)}
            >
              Pages
            </RibbonButton>
            <RibbonButton
              label="Insert page break"
              active={editor.isActive("pageBreak")}
              onAction={() => editor.chain().focus().setPageBreak().run()}
            >
              Page Break
            </RibbonButton>
            <RibbonButton
              label="Insert section break (next page)"
              active={
                editor.isActive("sectionBreak", { sectionType: "next-page" })
              }
              onAction={() =>
                editor.chain().focus().setSectionBreak("next-page").run()
              }
            >
              Section
            </RibbonButton>
            <RibbonButton
              label="Insert section break (continuous)"
              active={
                editor.isActive("sectionBreak", { sectionType: "continuous" })
              }
              onAction={() =>
                editor.chain().focus().setSectionBreak("continuous").run()
              }
            >
              Section ↵
            </RibbonButton>
            <RibbonButton
              label="Insert current page number"
              active={editor.isActive("pageNumber", { numbering: "current" })}
              onAction={() => editor.chain().focus().insertPageNumber("current").run()}
            >
              # Page
            </RibbonButton>
            <RibbonButton
              label="Insert total page count"
              active={editor.isActive("pageNumber", { numbering: "total" })}
              onAction={() => editor.chain().focus().insertPageNumber("total").run()}
            >
              # Pages
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group" role="group" aria-label="Editing">
            <RibbonButton
              label="Insert hyperlink"
              active={editor.isActive("link")}
              onAction={() => {
                const previous = editor.getAttributes("link").href as string | undefined;
                const url = window.prompt("Enter URL", previous ?? "https://");
                if (url === null) return;
                if (url === "") {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  return;
                }
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
              }}
            >
              Link
            </RibbonButton>
            <RibbonButton
              label="Undo"
              disabled={!toolbar.canUndo}
              onAction={() => {
                editor.commands.focus();
                editor.commands.undo();
              }}
            >
              Undo
            </RibbonButton>
            <RibbonButton
              label="Redo"
              disabled={!toolbar.canRedo}
              onAction={() => {
                editor.commands.focus();
                editor.commands.redo();
              }}
            >
              Redo
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group" role="group" aria-label="Import">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMPORT_ACCEPT}
              className="hidden"
              aria-hidden
              onChange={(e) => {
                onFilePicked(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <RibbonButton
              label="Import a document or image from this device"
              disabled={importing}
              onAction={() => fileInputRef.current?.click()}
            >
              {importing ? "Importing…" : "Import"}
            </RibbonButton>
            <RibbonButton
              label="Import from Google Drive"
              disabled={importing}
              onAction={() => void importCloudFile()}
            >
              Cloud
            </RibbonButton>
          </div>
        </div>
      )}

      {importError && (
        <p className="draft-editor__import-error" role="alert">
          {importError}
        </p>
      )}

      <div className="draft-editor__surface">
        {editor.isEmpty && !disabled && (
          <p className="draft-editor__placeholder">{placeholder}</p>
        )}
        <EditorContent
          editor={editor}
          className="draft-editor__content"
          style={{ zoom: zoom / 100 }}
        />
        <div className="draft-editor__zoom-controls" role="group" aria-label="Zoom">
          <ZoomRoundButton
            label="Zoom out"
            disabled={zoom <= ZOOM_MIN}
            onAction={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
          >
            −
          </ZoomRoundButton>
          <ZoomRoundButton
            label="Zoom in"
            disabled={zoom >= ZOOM_MAX}
            onAction={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
          >
            +
          </ZoomRoundButton>
        </div>
      </div>
    </div>
  );
},
);

function ZoomRoundButton({
  children,
  label,
  onAction,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onAction}
      className="draft-editor__zoom-btn"
    >
      {children}
    </button>
  );
}

function AlignButton({
  children,
  label,
  onAction,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onAction: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ?? false}
      title={label}
      onMouseDown={keepFocus}
      onClick={onAction}
      className={`draft-editor__align-btn${active ? " draft-editor__align-btn--active" : ""}`}
    >
      {children}
    </button>
  );
}

function RibbonButton({
  children,
  label,
  onAction,
  active,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  label: string;
  onAction: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active ?? false}
      title={label}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onAction}
      className={`draft-editor__btn ${active ? "draft-editor__btn--active" : ""} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
