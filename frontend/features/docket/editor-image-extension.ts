import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ResizableImageView } from "@/features/docket/editor-resizable-image";

function parseNumericAttr(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attributes) =>
          attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: () => null,
        renderHTML: (attributes) =>
          attributes.height ? { height: attributes.height } : {},
      },
      naturalWidth: {
        default: null,
        parseHTML: (element) => parseNumericAttr(element.getAttribute("data-natural-width")),
        renderHTML: (attributes) =>
          attributes.naturalWidth
            ? { "data-natural-width": String(attributes.naturalWidth) }
            : {},
      },
      naturalHeight: {
        default: null,
        parseHTML: (element) => parseNumericAttr(element.getAttribute("data-natural-height")),
        renderHTML: (attributes) =>
          attributes.naturalHeight
            ? { "data-natural-height": String(attributes.naturalHeight) }
            : {},
      },
      rotation: {
        default: 0,
        parseHTML: (element) => {
          const value = element.getAttribute("data-rotation");
          return value ? Number.parseInt(value, 10) : 0;
        },
        renderHTML: (attributes) =>
          attributes.rotation
            ? { "data-rotation": String(attributes.rotation) }
            : {},
      },
      posX: {
        default: 0,
        parseHTML: (element) =>
          parseNumericAttr(element.getAttribute("data-pos-x")) ??
          parseNumericAttr(element.getAttribute("data-margin-left")) ??
          parseNumericAttr(element.getAttribute("data-offset-x")) ??
          0,
        renderHTML: (attributes) =>
          attributes.posX ? { "data-pos-x": String(attributes.posX) } : {},
      },
      posY: {
        default: 0,
        parseHTML: (element) =>
          parseNumericAttr(element.getAttribute("data-pos-y")) ??
          parseNumericAttr(element.getAttribute("data-margin-top")) ??
          parseNumericAttr(element.getAttribute("data-offset-y")) ??
          0,
        renderHTML: (attributes) =>
          attributes.posY ? { "data-pos-y": String(attributes.posY) } : {},
      },
      marginLeft: {
        default: 0,
        parseHTML: () => 0,
        renderHTML: () => ({}),
      },
      marginTop: {
        default: 0,
        parseHTML: () => 0,
        renderHTML: () => ({}),
      },
      offsetX: {
        default: 0,
        parseHTML: () => 0,
        renderHTML: () => ({}),
      },
      offsetY: {
        default: 0,
        parseHTML: () => 0,
        renderHTML: () => ({}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
