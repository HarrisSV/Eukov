import Document from "@tiptap/extension-document";

/** Root document allows page sheets and manual page/section breaks. */
export const EditorDocument = Document.extend({
  content: "(pageSheet | pageBreak | sectionBreak | block)+",
});
