import { Extension } from "@tiptap/core";
import { Fragment, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { EDITOR_PAGE_CONTENT_HEIGHT_PX } from "@/lib/editor-page-layout";

export { EDITOR_PAGE_CONTENT_HEIGHT_PX };

export const pageFlowPluginKey = new PluginKey("pageFlow");

const EMPTY_BLOCK_HEIGHT_PX = 28;
const IMAGE_BLOCK_MARGIN_PX = 16;

/** Split before this block index when cumulative height exceeds the page. */
export function findPageSplitIndex(
  blockHeights: number[],
  maxHeight: number,
): number | null {
  if (blockHeights.length === 0 || maxHeight <= 0) {
    return null;
  }

  let used = 0;
  for (let index = 0; index < blockHeights.length; index += 1) {
    const blockHeight = blockHeights[index] ?? 0;
    if (blockHeight > maxHeight) {
      return null;
    }
    if (used + blockHeight > maxHeight) {
      return index > 0 ? index : null;
    }
    used += blockHeight;
  }

  return null;
}

function parseNumericAttr(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function imageBlockHeight(node: ProseMirrorNode): number {
  const height = parseNumericAttr(node.attrs.height);
  const posY = parseNumericAttr(node.attrs.posY ?? node.attrs.marginTop);
  if (height > 0) {
    return posY + height + IMAGE_BLOCK_MARGIN_PX;
  }
  return EDITOR_PAGE_CONTENT_HEIGHT_PX;
}

function estimateBlockHeight(node: ProseMirrorNode): number {
  if (node.type.name === "image") {
    return imageBlockHeight(node);
  }

  if (node.type.name === "heading") {
    return 40;
  }
  if (node.childCount === 0 || node.textContent.trim() === "") {
    return EMPTY_BLOCK_HEIGHT_PX;
  }
  return Math.max(
    EMPTY_BLOCK_HEIGHT_PX,
    Math.ceil(node.textContent.length / 72) * EMPTY_BLOCK_HEIGHT_PX,
  );
}

function isPageViewActive(view: EditorView): boolean {
  return view.dom.closest(".draft-editor--page-view") !== null;
}

function collectPageSheetPositions(doc: ProseMirrorNode): number[] {
  const positions: number[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "pageSheet") {
      positions.push(pos);
      return false;
    }
    return undefined;
  });

  return positions;
}

interface PageSheetContext {
  pageSheetPos: number;
  pageSheetNode: ProseMirrorNode;
  blockIndex: number;
}

function getPageSheetContext(view: EditorView): PageSheetContext | null {
  const { $from } = view.state.selection;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name !== "pageSheet") {
      continue;
    }

    return {
      pageSheetPos: $from.before(depth),
      pageSheetNode: $from.node(depth),
      blockIndex: $from.index(depth),
    };
  }

  return null;
}

function measureBlockHeights(
  view: EditorView,
  pageSheetPos: number,
  pageSheetNode: ProseMirrorNode,
): number[] {
  const heights: number[] = [];
  let childPos = pageSheetPos + 1;

  for (let index = 0; index < pageSheetNode.childCount; index += 1) {
    const child = pageSheetNode.child(index);
    const dom = view.nodeDOM(childPos);
    let measured = dom instanceof HTMLElement ? dom.offsetHeight : 0;

    if (child.type.name === "image") {
      measured = Math.max(measured, imageBlockHeight(child));
    }

    heights.push(measured > 0 ? measured : estimateBlockHeight(child));
    childPos += child.nodeSize;
  }

  return heights;
}

function usedHeightBeforeIndex(heights: number[], indexInclusive: number): number {
  return heights.slice(0, indexInclusive + 1).reduce((sum, height) => sum + height, 0);
}

function selectionPosInNewPageSheet(
  pageSheetPos: number,
  moved: Fragment,
  preferEnd: boolean,
): number {
  const insideSheet = pageSheetPos + 1;
  if (preferEnd && moved.childCount > 0) {
    let pos = insideSheet;
    for (let index = 0; index < moved.childCount - 1; index += 1) {
      pos += moved.child(index).nodeSize;
    }
    return pos + 1;
  }
  return insideSheet + 1;
}

function splitPageSheetAt(
  view: EditorView,
  pageSheetPos: number,
  pageSheetNode: ProseMirrorNode,
  splitAt: number,
  options?: { appendEmptyParagraph?: boolean; preferEndSelection?: boolean },
): boolean {
  const { state } = view;
  if (splitAt <= 0 || splitAt >= pageSheetNode.childCount) {
    return false;
  }

  const pageBreakType = state.schema.nodes.pageBreak;
  const pageSheetType = state.schema.nodes.pageSheet;
  const paragraphType = state.schema.nodes.paragraph;
  if (!pageBreakType || !pageSheetType) {
    return false;
  }

  const kept = pageSheetNode.content.cut(0, splitAt);
  let moved = pageSheetNode.content.cut(splitAt);
  if (moved.childCount === 0) {
    return false;
  }

  if (options?.appendEmptyParagraph && paragraphType) {
    moved = moved.append(Fragment.from(paragraphType.create()));
  }

  const end = pageSheetPos + pageSheetNode.nodeSize;
  let tr = state.tr.replaceWith(
    pageSheetPos,
    end,
    pageSheetNode.type.create(pageSheetNode.attrs, kept),
  );

  const afterSheetPos = pageSheetPos + tr.doc.nodeAt(pageSheetPos)!.nodeSize;
  const pageBreakNode = pageBreakType.create();
  tr = tr.insert(afterSheetPos, [
    pageBreakNode,
    pageSheetType.create(null, moved),
  ]);

  const newPagePos = afterSheetPos + pageBreakNode.nodeSize;
  const cursorPos = selectionPosInNewPageSheet(
    newPagePos,
    moved,
    options?.preferEndSelection ?? false,
  );
  tr.setSelection(TextSelection.create(tr.doc, Math.min(cursorPos, tr.doc.content.size - 1)));
  tr.scrollIntoView();
  tr.setMeta(pageFlowPluginKey, true);

  view.dispatch(tr);
  return true;
}

function splitOverflowingPageSheet(view: EditorView, pageSheetPos: number): boolean {
  const { state } = view;
  const pageSheetNode = state.doc.nodeAt(pageSheetPos);

  if (!pageSheetNode || pageSheetNode.type.name !== "pageSheet") {
    return false;
  }

  const blockHeights = measureBlockHeights(view, pageSheetPos, pageSheetNode);
  const splitAt = findPageSplitIndex(blockHeights, EDITOR_PAGE_CONTENT_HEIGHT_PX);

  if (splitAt == null) {
    return false;
  }

  return splitPageSheetAt(view, pageSheetPos, pageSheetNode, splitAt, {
    preferEndSelection: true,
  });
}

function findNextPageSheetStart(
  doc: ProseMirrorNode,
  afterPageSheetPos: number,
  pageSheetNode: ProseMirrorNode,
): number | null {
  let pos = afterPageSheetPos + pageSheetNode.nodeSize;
  const next = doc.nodeAt(pos);

  if (next?.type.name === "pageBreak") {
    pos += next.nodeSize;
    const sheet = doc.nodeAt(pos);
    if (sheet?.type.name === "pageSheet") {
      return pos;
    }
  }

  return null;
}

function appendNewPageWithEmptyParagraph(
  view: EditorView,
  pageSheetPos: number,
  pageSheetNode: ProseMirrorNode,
): boolean {
  const { state } = view;
  const pageBreakType = state.schema.nodes.pageBreak;
  const pageSheetType = state.schema.nodes.pageSheet;
  const paragraphType = state.schema.nodes.paragraph;
  if (!pageBreakType || !pageSheetType || !paragraphType) {
    return false;
  }

  const existingNextPagePos = findNextPageSheetStart(state.doc, pageSheetPos, pageSheetNode);
  if (existingNextPagePos != null) {
    const cursorPos = existingNextPagePos + 2;
    const tr = state.tr
      .setSelection(TextSelection.create(state.doc, Math.min(cursorPos, state.doc.content.size - 1)))
      .scrollIntoView()
      .setMeta(pageFlowPluginKey, true);
    view.dispatch(tr);
    return true;
  }

  const afterSheetPos = pageSheetPos + pageSheetNode.nodeSize;
  const pageBreakNode = pageBreakType.create();
  const newSheet = pageSheetType.create(null, Fragment.from(paragraphType.create()));

  let tr = state.tr.insert(afterSheetPos, [pageBreakNode, newSheet]);
  const newPagePos = afterSheetPos + pageBreakNode.nodeSize;
  tr = tr
    .setSelection(TextSelection.create(tr.doc, newPagePos + 2))
    .scrollIntoView()
    .setMeta(pageFlowPluginKey, true);

  view.dispatch(tr);
  return true;
}

function flowEnterToNextPage(view: EditorView): boolean {
  const context = getPageSheetContext(view);
  if (!context) {
    return false;
  }

  const { pageSheetPos, pageSheetNode, blockIndex } = context;
  const blockHeights = measureBlockHeights(view, pageSheetPos, pageSheetNode);
  const used = usedHeightBeforeIndex(blockHeights, blockIndex);

  if (used + EMPTY_BLOCK_HEIGHT_PX <= EDITOR_PAGE_CONTENT_HEIGHT_PX) {
    return false;
  }

  return appendNewPageWithEmptyParagraph(view, pageSheetPos, pageSheetNode);
}

function wrapLooseBlocksInPageSheet(view: EditorView): boolean {
  const { state } = view;
  if (collectPageSheetPositions(state.doc).length > 0) {
    return false;
  }

  const pageSheetType = state.schema.nodes.pageSheet;
  if (!pageSheetType || state.doc.childCount === 0) {
    return false;
  }

  const blockNodes = [];
  for (let index = 0; index < state.doc.childCount; index += 1) {
    const node = state.doc.child(index);
    if (node.type.name === "pageBreak" || node.type.name === "sectionBreak") {
      continue;
    }
    if (!node.type.isBlock) {
      return false;
    }
    blockNodes.push(node);
  }

  if (blockNodes.length === 0) {
    return false;
  }

  const sheet = pageSheetType.create(null, Fragment.from(blockNodes));
  const tr = state.tr.replaceWith(0, state.doc.content.size, sheet);
  tr.setMeta(pageFlowPluginKey, true);
  view.dispatch(tr);
  return true;
}

export function balancePageFlow(view: EditorView): void {
  if (!isPageViewActive(view)) {
    return;
  }

  if (collectPageSheetPositions(view.state.doc).length === 0) {
    if (wrapLooseBlocksInPageSheet(view)) {
      // Continue balancing after wrapping loose blocks.
    } else {
      return;
    }
  }

  for (let pass = 0; pass < 24; pass += 1) {
    let split = false;
    const positions = collectPageSheetPositions(view.state.doc);

    for (const pos of positions) {
      if (splitOverflowingPageSheet(view, pos)) {
        split = true;
        break;
      }
    }

    if (!split) {
      return;
    }
  }
}

function scheduleBalance(view: EditorView): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      balancePageFlow(view);
    });
  });
}

export const PageFlow = Extension.create({
  name: "pageFlow",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageFlowPluginKey,
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "Enter" || !isPageViewActive(view)) {
              return false;
            }

            if (flowEnterToNextPage(view)) {
              event.preventDefault();
              return true;
            }

            scheduleBalance(view);
            return false;
          },
        },
        view() {
          return {
            update(nextView, prevState) {
              if (
                nextView.state.doc.eq(prevState.doc) ||
                nextView.state.tr.getMeta(pageFlowPluginKey)
              ) {
                return;
              }

              scheduleBalance(nextView);
            },
          };
        },
      }),
    ];
  },
});
