export const FONT_FAMILIES: { label: string; value: string }[] = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Calibri", value: "Calibri, 'Segoe UI', sans-serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Garamond", value: "Garamond, 'Times New Roman', serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI', system-ui, sans-serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Consolas", value: "Consolas, 'Courier New', monospace" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive" },
  { label: "Palatino Linotype", value: "'Palatino Linotype', Palatino, serif" },
  { label: "Lucida Sans Unicode", value: "'Lucida Sans Unicode', 'Lucida Grande', sans-serif" },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
];

/** MS Word–style point sizes (stored as px in the editor). */
export const FONT_SIZE_POINTS = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
] as const;

export const DEFAULT_FONT_SIZE = 16;

export function sizeToPx(points: number): string {
  return `${points}px`;
}

export function pxToPoints(px: string | null | undefined): number {
  if (!px) return DEFAULT_FONT_SIZE;
  const n = parseInt(px.replace("px", ""), 10);
  return Number.isNaN(n) ? DEFAULT_FONT_SIZE : n;
}

export function matchFontValue(current: string | undefined): string {
  if (!current) return "";
  const normalized = current.toLowerCase().replace(/['"]/g, "");
  const hit = FONT_FAMILIES.find((f) => {
    if (!f.value) return false;
    const first = f.value.split(",")[0]?.toLowerCase().replace(/['"]/g, "").trim();
    return normalized.includes(first) || first.includes(normalized.split(",")[0]?.trim() ?? "");
  });
  return hit?.value ?? current;
}
