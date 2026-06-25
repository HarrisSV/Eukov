import { Node, mergeAttributes } from "@tiptap/core";

/** Visual page container used after import pagination. */
export const PageSheet = Node.create({
  name: "pageSheet",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="page-sheet"]' },
      { tag: "div.draft-page-sheet" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-sheet",
        class: "draft-page-sheet",
      }),
      0,
    ];
  },
});
