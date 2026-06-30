const GUTENBERG_TAG_PATTERN = /^gutenberg-(\d+)$/i;

const GENRE_ACCENTS: Record<string, string> = {
  literature: "#8B5A2B",
  history: "#6B4C3B",
  politics: "#4A5568",
  philosophy: "#5D4E6D",
  economics: "#2F6F4E",
  psychology: "#7C5E99",
  technology: "#3D5A80",
  science: "#2C5282",
};

export function parseGutenbergIdFromTags(tags: string[]): number | null {
  for (const tag of tags) {
    const match = tag.match(GUTENBERG_TAG_PATTERN);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function isGutenbergSeededBook(tags: string[]): boolean {
  return tags.some((tag) => tag.toLowerCase() === "gutenberg" || GUTENBERG_TAG_PATTERN.test(tag));
}

export function gutenbergCoverUrl(gutenbergId: number): string {
  return `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`;
}

function genreAccent(genreName?: string): string {
  if (!genreName) {
    return GENRE_ACCENTS.literature;
  }
  const key = genreName.toLowerCase().replace(/\s+/g, "-");
  return GENRE_ACCENTS[key] ?? GENRE_ACCENTS.literature;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapTitle(title: string, maxLineLength = 22, maxLines = 4): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return ["Untitled"];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    current = word;
    if (lines.length >= maxLines - 1) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 18 ? `${last.slice(0, 17)}…` : `${last}…`;
  }

  return lines.slice(0, maxLines);
}

export function buildGutenbergSourceCoverDataUrl(input: {
  title: string;
  authorName?: string;
  genreName?: string;
  gutenbergId?: number | null;
}): string {
  const accent = genreAccent(input.genreName);
  const titleLines = wrapTitle(input.title);
  const author = input.authorName?.trim() || "Public Domain";
  const idLabel = input.gutenbergId ? `#${input.gutenbergId}` : "Public Domain";
  const genreLabel = input.genreName?.toUpperCase() ?? "GUTENBERG";

  const titleSvg = titleLines
    .map((line, index) => {
      const y = 118 + index * 28;
      return `<text x="40" y="${y}" font-family="Georgia, 'Times New Roman', serif" font-size="22" font-weight="700" fill="#1E2A3A">${escapeXml(line)}</text>`;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FAF7F2"/>
      <stop offset="100%" stop-color="#F0E6D8"/>
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#bg)"/>
  <rect x="0" y="0" width="400" height="10" fill="${accent}"/>
  <rect x="28" y="36" width="120" height="22" rx="11" fill="${accent}" opacity="0.15"/>
  <text x="40" y="52" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="1.4" fill="${accent}">PROJECT GUTENBERG</text>
  ${titleSvg}
  <text x="40" y="280" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#6B5E54">by ${escapeXml(author)}</text>
  <rect x="28" y="318" width="344" height="1" fill="#E8D8C4"/>
  <text x="40" y="352" font-family="Helvetica, Arial, sans-serif" font-size="11" font-weight="600" letter-spacing="1.2" fill="${accent}">${escapeXml(genreLabel)}</text>
  <text x="40" y="378" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#6B5E54">Seeded from gutenberg.org</text>
  <text x="40" y="548" font-family="Helvetica, Arial, sans-serif" font-size="12" font-weight="600" fill="#1E2A3A">${escapeXml(idLabel)}</text>
  <text x="40" y="568" font-family="Helvetica, Arial, sans-serif" font-size="10" fill="#9A8B7A">EUKOV Library · Public Domain</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function resolveLibraryCoverCandidates(book: {
  coverUrl?: string;
  tags: string[];
  title: string;
  authorName?: string;
  genreName?: string;
}): string[] {
  const gutenbergId = parseGutenbergIdFromTags(book.tags);
  const generated = buildGutenbergSourceCoverDataUrl({
    title: book.title,
    authorName: book.authorName,
    genreName: book.genreName,
    gutenbergId,
  });

  if (!isGutenbergSeededBook(book.tags)) {
    return book.coverUrl?.trim() ? [book.coverUrl.trim()] : [generated];
  }

  const candidates: string[] = [];
  const stored = book.coverUrl?.trim();
  if (stored) {
    candidates.push(stored);
  }
  if (gutenbergId) {
    candidates.push(gutenbergCoverUrl(gutenbergId));
  }
  candidates.push(generated);

  return [...new Set(candidates)];
}

export function resolvePrimaryLibraryCoverUrl(book: {
  coverUrl?: string;
  tags: string[];
  title: string;
  authorName?: string;
  genreName?: string;
}): string {
  return resolveLibraryCoverCandidates(book)[0];
}
