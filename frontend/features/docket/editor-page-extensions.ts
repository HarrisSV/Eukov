import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type SectionBreakType = "next-page" | "continuous";

export function countPagesInDoc(doc: {
  descendants: (f: (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => void) => void;
}): number {
  let pages = 1;
  doc.descendants((node) => {
    if (node.type.name === "pageBreak") {
      pages += 1;
      return;
    }
    if (
      node.type.name === "sectionBreak" &&
      node.attrs.sectionType === "next-page"
    ) {
      pages += 1;
    }
  });
  return pages;
}

export function countPagesBefore(
  doc: {
    nodesBetween: (
      from: number,
      to: number,
      f: (node: { type: { name: string }; attrs: Record<string, unknown> }, pos: number) => void,
    ) => void;
  },
  pos: number,
): number {
  let pages = 1;
  doc.nodesBetween(0, pos, (node, nodePos) => {
    if (nodePos >= pos) return;
    if (node.type.name === "pageBreak") {
      pages += 1;
      return;
    }
    if (
      node.type.name === "sectionBreak" &&
      node.attrs.sectionType === "next-page"
    ) {
      pages += 1;
    }
  });
  return pages;
}

const pageBreakLabel = "—— Page Break ——";
const sectionLabels: Record<SectionBreakType, string> = {
  "next-page": "—— Section Break (Next Page) ——",
  continuous: "—— Section Break (Continuous) ——",
};

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="page-break"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-break",
        class: "editor-page-break",
        contenteditable: "false",
      }),
      ["span", { class: "editor-page-break__label" }, pageBreakLabel],
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

export const SectionBreak = Node.create({
  name: "sectionBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      sectionType: {
        default: "next-page" as SectionBreakType,
        parseHTML: (element) =>
          (element.getAttribute("data-section-type") as SectionBreakType) ||
          "next-page",
        renderHTML: (attributes) => ({
          "data-section-type": attributes.sectionType,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="section-break"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const sectionType = node.attrs.sectionType as SectionBreakType;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "section-break",
        class: `editor-section-break editor-section-break--${sectionType}`,
        contenteditable: "false",
      }),
      [
        "span",
        { class: "editor-section-break__label" },
        sectionLabels[sectionType] ?? sectionLabels["next-page"],
      ],
    ];
  },

  addCommands() {
    return {
      setSectionBreak:
        (sectionType: SectionBreakType) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { sectionType },
          }),
    };
  },
});

export const PageNumber = Node.create({
  name: "pageNumber",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      numbering: {
        default: "current",
        parseHTML: (element) =>
          element.getAttribute("data-numbering") || "current",
        renderHTML: (attributes) => ({
          "data-numbering": attributes.numbering,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="page-number"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const numbering = node.attrs.numbering as string;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "page-number",
        class: "editor-page-number",
        contenteditable: "false",
      }),
      numbering === "total" ? "?" : "?",
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement("span");
      dom.className = "editor-page-number";
      dom.setAttribute("data-type", "page-number");
      dom.contentEditable = "false";

      const render = (fieldNode = node) => {
        const pos = getPos();
        const numbering = fieldNode.attrs.numbering as string;
        const doc = editor.state.doc;
        const current = typeof pos === "number" ? countPagesBefore(doc, pos) : 1;
        const total = countPagesInDoc(doc);
        dom.textContent = numbering === "total" ? String(total) : String(current);
        dom.title =
          numbering === "total"
            ? "Total page count (field)"
            : "Current page number (field)";
      };

      render();

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "pageNumber") {
            return false;
          }
          render(updatedNode);
          return true;
        },
      };
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("pageNumberRefresh"),
        view: () => ({
          update: (nextView, prevState) => {
            if (nextView.state.doc.eq(prevState.doc)) {
              return;
            }
            nextView.state.doc.descendants((fieldNode, pos) => {
              if (fieldNode.type.name !== "pageNumber") {
                return;
              }
              const dom = nextView.nodeDOM(pos);
              if (!(dom instanceof HTMLElement)) {
                return;
              }
              const numbering = fieldNode.attrs.numbering as string;
              const current = countPagesBefore(nextView.state.doc, pos);
              const total = countPagesInDoc(nextView.state.doc);
              dom.textContent =
                numbering === "total" ? String(total) : String(current);
            });
          },
        }),
      }),
    ];
  },

  addCommands() {
    return {
      insertPageNumber:
        (numbering: "current" | "total" = "current") =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { numbering },
          }),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType;
    };
    sectionBreak: {
      setSectionBreak: (sectionType: SectionBreakType) => ReturnType;
    };
    pageNumber: {
      insertPageNumber: (numbering?: "current" | "total") => ReturnType;
    };
  }
}
