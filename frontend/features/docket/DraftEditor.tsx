"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import "./draft-editor.css";

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
});

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Sans", value: "Inter, system-ui, sans-serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px", "32px"];

/** Prevent editor blur when clicking toolbar — required for Word-like button behavior. */
function keepFocus(e: React.MouseEvent) {
  e.preventDefault();
}

interface DraftEditorProps {
  content: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function DraftEditor({
  content,
  onChange,
  disabled = false,
  placeholder = "Start writing or import a document...",
}: DraftEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloudInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: content || "<p></p>",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap",
        "aria-label": "Draft editor",
        spellcheck: "true",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current && content !== undefined) {
      editor.commands.setContent(content || "<p></p>", { emitUpdate: false });
    }
  }, [content, editor]);

  const importDocFile = useCallback(
    async (file: File) => {
      if (!editor) return;
      setImportError(null);

      const name = file.name.toLowerCase();
      if (!name.endsWith(".doc")) {
        setImportError("Only .doc files are accepted. Use Word 97-2003 format (.doc).");
        return;
      }

      setImporting(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/import-doc", {
          method: "POST",
          body: form,
        });
        const data = (await response.json()) as { html?: string; error?: string };
        if (!response.ok) {
          setImportError(data.error ?? "Import failed");
          return;
        }
        const html = data.html ?? "<p></p>";
        editor.commands.setContent(html);
        onChange(editor.getHTML());
      } catch {
        setImportError("Could not import file. Check your connection and try again.");
      } finally {
        setImporting(false);
      }
    },
    [editor, onChange],
  );

  const onFilePicked = (file: File | undefined) => {
    if (file) void importDocFile(file);
  };

  if (!editor) {
    return (
      <div className="draft-editor">
        <div className="draft-editor__surface p-4 text-sm text-muted">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className={`draft-editor${disabled ? " draft-editor--readonly" : ""}`}>
      {!disabled && (
        <div className="draft-editor__toolbar" role="toolbar" aria-label="Formatting toolbar">
          <div className="draft-editor__group">
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

          <div className="draft-editor__group">
            <RibbonButton
              label="Heading 1"
              active={editor.isActive("heading", { level: 1 })}
              onAction={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              H1
            </RibbonButton>
            <RibbonButton
              label="Heading 2"
              active={editor.isActive("heading", { level: 2 })}
              onAction={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              H2
            </RibbonButton>
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

          <div className="draft-editor__group">
            <RibbonButton
              label="Align left"
              active={editor.isActive({ textAlign: "left" })}
              onAction={() => editor.chain().focus().setTextAlign("left").run()}
            >
              Left
            </RibbonButton>
            <RibbonButton
              label="Align center"
              active={editor.isActive({ textAlign: "center" })}
              onAction={() => editor.chain().focus().setTextAlign("center").run()}
            >
              Center
            </RibbonButton>
            <RibbonButton
              label="Align right"
              active={editor.isActive({ textAlign: "right" })}
              onAction={() => editor.chain().focus().setTextAlign("right").run()}
            >
              Right
            </RibbonButton>
            <RibbonButton
              label="Justify"
              active={editor.isActive({ textAlign: "justify" })}
              onAction={() => editor.chain().focus().setTextAlign("justify").run()}
            >
              Justify
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group">
            <label className="draft-editor__select-wrap">
              Font
              <select
                className="draft-editor__select"
                defaultValue=""
                onMouseDown={keepFocus}
                onChange={(e) =>
                  editor.chain().focus().setFontFamily(e.target.value).run()
                }
                aria-label="Font family"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="draft-editor__select-wrap">
              Size
              <select
                className="draft-editor__select"
                defaultValue="16px"
                onMouseDown={keepFocus}
                onChange={(e) =>
                  editor
                    .chain()
                    .focus()
                    .setMark("textStyle", { fontSize: e.target.value })
                    .run()
                }
                aria-label="Font size"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group">
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
              disabled={!editor.can().chain().focus().undo().run()}
              onAction={() => editor.chain().focus().undo().run()}
            >
              Undo
            </RibbonButton>
            <RibbonButton
              label="Redo"
              disabled={!editor.can().chain().focus().redo().run()}
              onAction={() => editor.chain().focus().redo().run()}
            >
              Redo
            </RibbonButton>
          </div>

          <div className="draft-editor__divider" aria-hidden />

          <div className="draft-editor__group">
            <input
              ref={fileInputRef}
              type="file"
              accept=".doc,application/msword"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                onFilePicked(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={cloudInputRef}
              type="file"
              accept=".doc,application/msword"
              className="hidden"
              aria-hidden
              onChange={(e) => {
                onFilePicked(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <RibbonButton
              label="Import .doc from this device"
              disabled={importing}
              onAction={() => fileInputRef.current?.click()}
            >
              {importing ? "Importing…" : "Import"}
            </RibbonButton>
            <RibbonButton
              label="Import .doc from cloud storage"
              disabled={importing}
              onAction={() => cloudInputRef.current?.click()}
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
        <EditorContent editor={editor} className="draft-editor__content" />
      </div>
    </div>
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
