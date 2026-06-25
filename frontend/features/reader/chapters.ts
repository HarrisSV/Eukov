import { isHtmlContent } from "@/features/reader/page-content";

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

export type ChapterHeadingTag = (typeof HEADING_TAGS)[number];

export interface BookChapter {
  id: string;
  title: string;
  pageNumber: number;
}

export interface BookPageInput {
  pageNumber: number;
  content: string;
}

function parseHtmlFragment(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(`<body>${html}</body>`, "text/html");
}

/** Editor books use h1; imported books fall back to the first heading level present. */
export function resolveChapterHeadingTag(
  pages: Array<{ content: string }>,
): ChapterHeadingTag | null {
  const tagsPresent = new Set<ChapterHeadingTag>();

  for (const page of pages) {
    if (!isHtmlContent(page.content)) {
      continue;
    }

    const doc = parseHtmlFragment(page.content);
    for (const tag of HEADING_TAGS) {
      if (doc.querySelector(tag)) {
        tagsPresent.add(tag);
      }
    }
  }

  if (tagsPresent.has("h1")) {
    return "h1";
  }

  for (const tag of HEADING_TAGS) {
    if (tag !== "h1" && tagsPresent.has(tag)) {
      return tag;
    }
  }

  return null;
}

export function annotateChapters(pages: BookPageInput[]): {
  chapters: BookChapter[];
  pages: BookPageInput[];
} {
  const headingTag = resolveChapterHeadingTag(pages);
  if (!headingTag) {
    return { chapters: [], pages };
  }

  const chapters: BookChapter[] = [];
  let chapterIndex = 0;

  const annotatedPages = pages.map((page) => {
    if (!isHtmlContent(page.content)) {
      return page;
    }

    const doc = parseHtmlFragment(page.content);
    let changed = false;

    for (const heading of doc.querySelectorAll(headingTag)) {
      const title = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!title) {
        continue;
      }

      const id = `chapter-${chapterIndex}`;
      heading.setAttribute("data-chapter-id", id);
      chapters.push({
        id,
        title,
        pageNumber: page.pageNumber,
      });
      chapterIndex += 1;
      changed = true;
    }

    if (!changed) {
      return page;
    }

    return {
      ...page,
      content: doc.body.innerHTML,
    };
  });

  return { chapters, pages: annotatedPages };
}

export function activeChapterId(
  chapters: BookChapter[],
  currentPage: number,
): string | null {
  if (chapters.length === 0) {
    return null;
  }

  let active = chapters[0]!.id;
  for (const chapter of chapters) {
    if (chapter.pageNumber <= currentPage) {
      active = chapter.id;
      continue;
    }
    break;
  }

  return active;
}
