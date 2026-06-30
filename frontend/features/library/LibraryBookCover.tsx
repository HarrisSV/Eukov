"use client";

import { useMemo, useState } from "react";
import { decodePageCoverUrl } from "@/lib/book-cover";
import { resolveLibraryCoverCandidates } from "@/lib/gutenberg-covers";
import { PageCoverThumbnail } from "@/features/library/PageCoverThumbnail";
import "@/features/library/library-page-cover.css";

interface LibraryBookCoverProps {
  coverUrl?: string;
  tags: string[];
  title: string;
  authorName?: string;
  genreName?: string;
  className?: string;
}

export function LibraryBookCover({
  coverUrl,
  tags,
  title,
  authorName,
  genreName,
  className,
}: LibraryBookCoverProps) {
  const candidates = useMemo(
    () =>
      resolveLibraryCoverCandidates({
        coverUrl,
        tags,
        title,
        authorName,
        genreName,
      }),
    [authorName, coverUrl, genreName, tags, title],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[Math.min(candidateIndex, candidates.length - 1)];
  const pageCoverHtml = useMemo(() => decodePageCoverUrl(coverUrl), [coverUrl]);

  if (pageCoverHtml) {
    return <PageCoverThumbnail pageHtml={pageCoverHtml} className={className} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      loading="lazy"
      onError={() => {
        setCandidateIndex((current) => {
          if (current + 1 < candidates.length) {
            return current + 1;
          }
          return current;
        });
      }}
    />
  );
}
