import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style";
import { ResizableImage } from "@/features/docket/editor-image-extension";
import {
  PageBreak,
  PageNumber,
  SectionBreak,
} from "@/features/docket/editor-page-extensions";
import { EditorDocument } from "@/features/docket/editor-document";
import { PageFlow } from "@/features/docket/editor-page-flow";
import { PageSheet } from "@/features/docket/editor-page-sheet";

/**
 * Draft editor extensions.
 *
 * TipTap Pages Pro (recommended for Word-like pagination):
 * 1. Get a token at https://cloud.tiptap.dev → Pro Extensions
 * 2. Run: TIPTAP_PRO_TOKEN=your-token npm run tiptap:pro
 * 3. Set NEXT_PUBLIC_USE_TIPTAP_PAGES=true in .env
 */
export function createDraftEditorExtensions(): Extensions {
  if (process.env.NEXT_PUBLIC_USE_TIPTAP_PAGES === "true") {
    throw new Error(
      "NEXT_PUBLIC_USE_TIPTAP_PAGES is enabled but Pages Pro is not wired yet. " +
        "Run TIPTAP_PRO_TOKEN=your-token npm run tiptap:pro, then ask to enable the Pages migration.",
    );
  }

  return [
    StarterKit.configure({
      document: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      trailingNode: false,
      underline: false,
      link: false,
    }),
    EditorDocument,
    Underline,
    Link.configure({ openOnClick: false }),
    TextStyle,
    FontFamily,
    FontSize,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    ResizableImage.configure({ allowBase64: true }),
    PageSheet,
    PageFlow,
    PageBreak,
    SectionBreak,
    PageNumber,
  ];
}
