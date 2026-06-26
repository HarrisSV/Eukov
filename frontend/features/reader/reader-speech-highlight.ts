const TTS_HIGHLIGHT_CLASS = "reader-tts-highlight";

interface PlainCharMap {
  plainIndex: number;
  node: Text;
  nodeOffset: number;
}

function buildPlainCharMap(root: HTMLElement): { plainText: string; map: PlainCharMap[] } {
  const map: PlainCharMap[] = [];
  let plain = "";
  let lastWasWhitespace = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const content = node.textContent ?? "";

    for (let offset = 0; offset < content.length; offset += 1) {
      const character = content[offset];
      if (/\s/.test(character)) {
        if (plain.length > 0 && !lastWasWhitespace) {
          map.push({ plainIndex: plain.length, node, nodeOffset: offset });
          plain += " ";
          lastWasWhitespace = true;
        }
        continue;
      }

      map.push({ plainIndex: plain.length, node, nodeOffset: offset });
      plain += character;
      lastWasWhitespace = false;
    }
  }

  return { plainText: plain.trim(), map };
}

function mapEntryAt(map: PlainCharMap[], plainIndex: number): PlainCharMap | null {
  if (map.length === 0) {
    return null;
  }

  let match = map[0];
  for (const entry of map) {
    if (entry.plainIndex > plainIndex) {
      break;
    }
    match = entry;
  }
  return match;
}

function unwrapMark(mark: HTMLElement) {
  const parent = mark.parentNode;
  if (!parent) {
    return;
  }
  parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
  parent.normalize();
}

let activeMark: HTMLElement | null = null;

export function clearActiveTtsHighlight() {
  if (!activeMark) {
    return;
  }
  if (activeMark.isConnected) {
    unwrapMark(activeMark);
  }
  activeMark = null;
}

export function clearAllTtsHighlights(root: ParentNode = document) {
  clearActiveTtsHighlight();
  root.querySelectorAll(`mark.${TTS_HIGHLIGHT_CLASS}`).forEach((node) => {
    if (node instanceof HTMLElement) {
      unwrapMark(node);
    }
  });
}

export function highlightWordOnPage(pageNumber: number, localStart: number, localEnd: number) {
  if (localEnd <= localStart) {
    clearActiveTtsHighlight();
    return;
  }

  const container = document.querySelector(
    `[data-flipbook-page="${pageNumber}"] .reader-page__text-inner`,
  ) as HTMLElement | null;

  if (!container) {
    clearActiveTtsHighlight();
    return;
  }

  clearActiveTtsHighlight();

  const { map } = buildPlainCharMap(container);
  const startEntry = mapEntryAt(map, localStart);
  const endEntry = mapEntryAt(map, Math.max(localStart, localEnd - 1));

  if (!startEntry || !endEntry) {
    return;
  }

  const range = document.createRange();
  range.setStart(startEntry.node, startEntry.nodeOffset);
  range.setEnd(endEntry.node, endEntry.nodeOffset + 1);

  const mark = document.createElement("mark");
  mark.className = TTS_HIGHLIGHT_CLASS;

  try {
    range.surroundContents(mark);
  } catch {
    const contents = range.extractContents();
    mark.appendChild(contents);
    range.insertNode(mark);
  }

  activeMark = mark;
  const scrollContainer = container.closest(".reader-page__text") as HTMLElement | null;
  mark.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (scrollContainer) {
    const markRect = mark.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    if (markRect.top < containerRect.top || markRect.bottom > containerRect.bottom) {
      const offset = mark.offsetTop - scrollContainer.clientHeight / 2;
      scrollContainer.scrollTop = Math.max(0, offset);
    }
  }
}
