"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import FontFamily from "@tiptap/extension-font-family";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import mammoth from "mammoth";
import { useEffect, useRef } from "react";

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
        class:
          "min-h-[360px] flex-1 px-4 py-3 outline-none prose max-w-none text-foreground",
        "aria-label": "Draft editor",
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

  const importDocx = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    editor?.commands.setContent(result.value || "<p></p>");
    onChange(editor?.getHTML() ?? "");
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !editor) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".docx") || name.endsWith(".doc")) {
      await importDocx(file);
      return;
    }
    const text = await file.text();
    editor.commands.setContent(`<p>${text.replace(/\n/g, "</p><p>")}</p>`);
    onChange(editor.getHTML());
  };

  if (!editor) {
    return (
      <div className="border-2 border-foreground bg-surface p-4 text-sm text-muted">
        Loading editor...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2 border-2 border-foreground bg-background">
      {!disabled && (
        <div
          className="flex flex-wrap items-center gap-1 border-b-2 border-border bg-surface p-2"
          role="toolbar"
          aria-label="Formatting toolbar"
        >
          <ToolbarButton
            label="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            U
          </ToolbarButton>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <ToolbarButton
            label="Heading 1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            • List
          </ToolbarButton>
          <ToolbarButton
            label="Ordered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1. List
          </ToolbarButton>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <ToolbarButton
            label="Align left"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            Left
          </ToolbarButton>
          <ToolbarButton
            label="Align center"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            Center
          </ToolbarButton>
          <ToolbarButton
            label="Align right"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            Right
          </ToolbarButton>
          <ToolbarButton
            label="Justify"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            Justify
          </ToolbarButton>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <label className="flex items-center gap-1 text-xs text-foreground">
            Font
            <select
              className="border border-foreground bg-background px-1 py-0.5 text-xs"
              onChange={(e) =>
                editor.chain().focus().setFontFamily(e.target.value).run()
              }
              defaultValue=""
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-xs text-foreground">
            Size
            <select
              className="border border-foreground bg-background px-1 py-0.5 text-xs"
              onChange={(e) =>
                editor.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run()
              }
              defaultValue="16px"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <ToolbarButton
            label="Insert link"
            onClick={() => {
              const url = window.prompt("Link URL");
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
          >
            Link
          </ToolbarButton>
          <ToolbarButton
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
          >
            Undo
          </ToolbarButton>
          <ToolbarButton
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
          >
            Redo
          </ToolbarButton>
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <input
            ref={fileInputRef}
            type="file"
            accept=".doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={cloudInputRef}
            type="file"
            accept=".doc,.docx"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <ToolbarButton
            label="Import from device"
            onClick={() => fileInputRef.current?.click()}
          >
            Import
          </ToolbarButton>
          <ToolbarButton
            label="Import from cloud"
            onClick={() => cloudInputRef.current?.click()}
          >
            Cloud
          </ToolbarButton>
        </div>
      )}
      <div className="relative flex flex-1 flex-col">
        {editor.isEmpty && !disabled && (
          <p className="pointer-events-none absolute left-4 top-3 text-sm text-muted">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`border border-foreground px-2 py-0.5 text-xs font-medium text-foreground ${
        active ? "bg-foreground text-background" : "bg-background"
      }`}
    >
      {children}
    </button>
  );
}
