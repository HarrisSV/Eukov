export function scrollToReadingPosition(
  container: HTMLElement,
  charOffset?: number,
): void {
  if (charOffset == null || charOffset < 0) {
    container.scrollTop = 0;
    container.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let counted = 0;

  while (walker.nextNode()) {
    const textNode = walker.currentNode as Text;
    const nextCount = counted + textNode.length;
    if (nextCount >= charOffset) {
      const range = document.createRange();
      range.setStart(textNode, Math.max(0, charOffset - counted));
      range.collapse(true);

      const marker = document.createElement("span");
      marker.className = "reader-bookmark-marker";
      marker.setAttribute("aria-hidden", "true");
      range.insertNode(marker);
      marker.scrollIntoView({ block: "center", behavior: "smooth" });

      window.setTimeout(() => {
        marker.remove();
      }, 2500);
      return;
    }
    counted = nextCount;
  }

  container.scrollIntoView({ block: "center", behavior: "smooth" });
}
