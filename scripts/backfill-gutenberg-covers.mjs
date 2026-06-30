#!/usr/bin/env node
/**
 * Backfill cover_url for Gutenberg-seeded library books.
 *
 * Usage: node scripts/backfill-gutenberg-covers.mjs
 * Requires: backend at localhost:8080, postgres reachable (or docker eukov-postgres).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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
  env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8080/api/v1";
const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL ?? env.SUPER_ADMIN_EMAIL ?? "superadmin@eukov.local";
const SUPER_ADMIN_PASSWORD =
  process.env.SUPER_ADMIN_PASSWORD ?? env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin123!";
const DATABASE_URL =
  process.env.DATABASE_URL ??
  env.DATABASE_URL ??
  "postgres://eukov:eukov_secret@localhost:5432/eukov?sslmode=disable";

function parseGutenbergId(tags) {
  for (const tag of tags) {
    const match = tag.match(/^gutenberg-(\d+)$/i);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function gutenbergCoverUrl(id) {
  return `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`;
}

async function api(method, route, token, body) {
  const response = await fetch(`${API_BASE}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${route} failed (${response.status}): ${data.error ?? ""}`);
  }
  return data;
}

function runSql(sql) {
  try {
    execSync(`docker exec -i eukov-postgres psql -U eukov -d eukov -v ON_ERROR_STOP=1 -c ${JSON.stringify(sql)}`, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    throw new Error("Backend not healthy — start the server first.");
  }

  const login = await api("POST", "/auth/login", null, {
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
  });
  const token = login.accessToken;

  const library = await api("GET", "/library?sort=newest", token);
  const books = library.books ?? [];

  let updated = 0;
  let skipped = 0;

  for (const book of books) {
    const gutenbergId = parseGutenbergId(book.tags ?? []);
    if (!gutenbergId) {
      skipped += 1;
      continue;
    }

    const coverUrl = gutenbergCoverUrl(gutenbergId);
    if (book.coverUrl === coverUrl) {
      skipped += 1;
      continue;
    }

    const escaped = coverUrl.replace(/'/g, "''");
    const docId = book.id.replace(/'/g, "''");
    const sql = `UPDATE document_metadata SET cover_url = '${escaped}' WHERE document_id = '${docId}';`;

    if (runSql(sql)) {
      updated += 1;
      console.log(`  updated: ${book.title} → ${coverUrl}`);
      continue;
    }

    console.warn(`  skipped (db): ${book.title}`);
    skipped += 1;
  }

  console.log(`\nDone. Updated ${updated} covers, skipped ${skipped}. DATABASE_URL=${DATABASE_URL.split("@")[1] ?? "local"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
