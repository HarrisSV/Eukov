#!/usr/bin/env node
/**
 * Fetches 50 public-domain books from Project Gutenberg (via Gutendex)
 * and publishes them to the Eukov library under the super admin account.
 *
 * Usage: node scripts/seed-public-library.mjs
 * Requires: backend at localhost:8080, migration 000025 applied.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnv();
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://localhost:8080/api/v1";
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? env.SUPER_ADMIN_EMAIL ?? "superadmin@eukov.local";
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD ?? env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";

const TARGET_TOTAL = 50;
const GUTENDEX = "https://gutendex.com/books/";

const GENRE_PLAN = [
  { genre: "philosophy", search: "philosophy", count: 7 },
  { genre: "history", search: "history", count: 7 },
  { genre: "politics", search: "political", count: 6 },
  { genre: "literature", search: "fiction", count: 7 },
  { genre: "economics", search: "economics", count: 6 },
  { genre: "psychology", search: "psychology", count: 6 },
  { genre: "technology", search: "engineering", count: 6 },
  { genre: "science", search: "science", count: 5 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateTitle(title) {
  const trimmed = title.trim();
  if (trimmed.length <= 255) {
    return trimmed;
  }
  return `${trimmed.slice(0, 252).trim()}…`;
}

function slugTag(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToHtml(text) {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return "<p></p>";
  }
  return paragraphs.map((p) => `<p>${escapeHtml(p.replace(/\n/g, " "))}</p>`).join("");
}

function buildReaderHtml({ title, author, coverUrl, bodyHtml }) {
  const authorLine = author ? `<p><em>${escapeHtml(author)}</em></p>` : "";
  const cover = coverUrl
    ? `<figure><img src="${coverUrl}" alt="${escapeHtml(title)}" style="max-width:240px;height:auto;" /></figure>`
    : "";
  return `${cover}<h1>${escapeHtml(title)}</h1>${authorLine}${bodyHtml}`;
}

function buildTags(book) {
  const tags = new Set(["public-domain", "gutenberg", `gutenberg-${book.id}`]);
  for (const subject of book.subjects ?? []) {
    const tag = slugTag(subject.split("--")[0] ?? subject);
    if (tag) tags.add(tag);
  }
  if (book.authors?.[0]?.name) {
    tags.add(slugTag(book.authors[0].name));
  }
  return [...tags].slice(0, 8);
}

async function api(method, path, token, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `${method} ${path} failed (${response.status}): ${data.error ?? JSON.stringify(data)}`,
    );
  }
  return data;
}

async function login() {
  const data = await api("POST", "/auth/login", null, {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  });
  return data.accessToken;
}

async function listPublishedTitles(token) {
  const data = await api("GET", "/library?sort=newest", token);
  return new Set((data.books ?? []).map((b) => b.title.toLowerCase()));
}

async function fetchGutendexPage(search, page) {
  const url = new URL(GUTENDEX);
  url.searchParams.set("search", search);
  url.searchParams.set("page", String(page));
  url.searchParams.set("languages", "en");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gutendex ${response.status} for ${search} page ${page}`);
  }
  return response.json();
}

function rewriteGutenbergMediaUrls(html, bookId) {
  if (!bookId || !html.includes("images/")) {
    return html;
  }
  const base = `https://www.gutenberg.org/files/${bookId}/${bookId}-h/`;
  return html.replace(
    /\b(src)\s*=\s*["'](?!https?:|data:|\/)(images\/[^"']+)["']/gi,
    (_, attr, path) => `${attr}="${base}${path}"`,
  );
}

async function fetchBookBody(formats, bookId) {
  const htmlUrl = formats["text/html"];
  const plainUrl =
    formats["text/plain; charset=utf-8"] ?? formats["text/plain; charset=us-ascii"];

  if (htmlUrl) {
    const response = await fetch(htmlUrl);
    if (!response.ok) {
      throw new Error(`HTML fetch ${response.status}`);
    }
    let html = await response.text();
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      html = bodyMatch[1];
    }
    html = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    return rewriteGutenbergMediaUrls(html.trim(), bookId);
  }

  if (plainUrl) {
    const response = await fetch(plainUrl);
    if (!response.ok) {
      throw new Error(`Plain fetch ${response.status}`);
    }
    const text = await response.text();
    return plainTextToHtml(text);
  }

  throw new Error("No readable format");
}

async function collectBooksForGenre(plan, usedGutenbergIds) {
  const collected = [];
  let page = 1;

  while (collected.length < plan.count && page <= 8) {
    const payload = await fetchGutendexPage(plan.search, page);
    for (const book of payload.results ?? []) {
      if (book.copyright) continue;
      if (usedGutenbergIds.has(book.id)) continue;
      if (!(book.languages ?? []).includes("en")) continue;
      if (!book.formats) continue;

      collected.push({ ...book, genre: plan.genre });
      usedGutenbergIds.add(book.id);
      if (collected.length >= plan.count) break;
    }
    if (!payload.next) break;
    page += 1;
    await sleep(300);
  }

  return collected;
}

async function publishBook(token, book, existingTitles) {
  const title = truncateTitle(book.title);
  if (existingTitles.has(title.toLowerCase())) {
    console.log(`  skip (exists): ${title}`);
    return false;
  }

  const author = book.authors?.[0]?.name ?? "Unknown";
  const coverUrl = book.formats["image/jpeg"] ?? "";
  let bodyHtml;
  try {
    bodyHtml = await fetchBookBody(book.formats, book.id);
  } catch (error) {
    console.log(`  skip (content): ${title} — ${error.message}`);
    return false;
  }

  const plainLen = bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  if (plainLen < 200) {
    console.log(`  skip (too short): ${title}`);
    return false;
  }

  const content = buildReaderHtml({ title, author, coverUrl, bodyHtml });
  const tags = buildTags(book);

  const draft = await api("POST", "/documents", token, {
    title,
    content,
    contentFormat: "html",
  });

  await api("POST", `/documents/${draft.document.id}/publish`, token, {
    title,
    genre: book.genre,
    tags,
    content,
    contentFormat: "html",
    coverUrl,
    authorName: author,
  });

  existingTitles.add(title.toLowerCase());
  console.log(`  published: ${title} [${book.genre}]`);
  return true;
}

async function main() {
  console.log(`API: ${API_BASE}`);
  console.log(`Super admin: ${SUPER_ADMIN_EMAIL}`);

  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    throw new Error("Backend not healthy — start the server first.");
  }

  const token = await login();
  const existingTitles = await listPublishedTitles(token);
  console.log(`Existing published books: ${existingTitles.size}`);

  const usedGutenbergIds = new Set();
  const queue = [];

  for (const plan of GENRE_PLAN) {
    console.log(`Fetching ${plan.count} × ${plan.genre} (search: ${plan.search})…`);
    const books = await collectBooksForGenre(plan, usedGutenbergIds);
    console.log(`  found ${books.length}`);
    queue.push(...books);
  }

  if (queue.length < TARGET_TOTAL) {
    console.warn(`Warning: only ${queue.length} candidates (target ${TARGET_TOTAL})`);
  }

  let published = 0;
  for (const book of queue.slice(0, TARGET_TOTAL)) {
    try {
      const ok = await publishBook(token, book, existingTitles);
      if (ok) published += 1;
      await sleep(400);
    } catch (error) {
      console.error(`  error: ${book.title} — ${error.message}`);
    }
  }

  const finalCount = (await listPublishedTitles(token)).size;
  console.log(`\nDone. Published ${published} new books (${finalCount} total in catalog).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
