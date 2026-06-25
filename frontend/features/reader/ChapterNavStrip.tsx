"use client";

import type { BookChapter } from "@/features/reader/chapters";

interface ChapterNavStripProps {
  chapters: BookChapter[];
  activeChapterId: string | null;
  onSelect: (chapter: BookChapter) => void;
}

export function ChapterNavStrip({
  chapters,
  activeChapterId,
  onSelect,
}: ChapterNavStripProps) {
  if (chapters.length === 0) {
    return null;
  }

  return (
    <aside className="reader-chapters" aria-label="Chapters">
      <p className="reader-chapters__label">Chapters</p>
      <nav className="reader-chapters__list">
        {chapters.map((chapter) => {
          const active = chapter.id === activeChapterId;

          return (
            <button
              key={chapter.id}
              type="button"
              className={`reader-chapters__item${active ? " reader-chapters__item--active" : ""}`}
              aria-current={active ? "location" : undefined}
              title={`Page ${chapter.pageNumber}`}
              onClick={() => onSelect(chapter)}
            >
              {chapter.title}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
