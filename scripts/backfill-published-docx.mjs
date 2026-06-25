#!/usr/bin/env node
/**
 * Pre-converts published HTML books to on-disk .docx sidecars so the editor
 * loads instantly (ReadAuthorDraft prefers docx over reader HTML).
 *
 * Usage: node scripts/backfill-published-docx.mjs [--limit N] [--title "lorem ipsum"]
 * Requires: Postgres running, frontend deps installed (html-to-docx).
 */

import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HTMLtoDOCX = require("../frontend/node_modules/html-to-docx/dist/html-to-docx.umd.js");

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
const DATABASE_URL =
  process.env.DATABASE_URL ??
  env.DATABASE_URL ??
  "postgres://eukov:eukov_secret@localhost:5432/eukov";
const UPLOAD_BASE_PATH = (() => {
  const raw = process.env.UPLOAD_BASE_PATH ?? env.UPLOAD_BASE_PATH ?? "./uploads";
  if (path.isAbsolute(raw)) {
    return raw;
  }
  const fromBackend = path.resolve(ROOT, "backend", raw);
  if (fs.existsSync(fromBackend)) {
    return fromBackend;
  }
  return path.resolve(ROOT, raw);
})();

function psqlCommand() {
  try {
    execSync("command -v psql", { stdio: "ignore" });
    return `psql "${DATABASE_URL}"`;
  } catch {
    return "docker exec -i eukov-postgres psql -U eukov -d eukov";
  }
}

const PSQL = psqlCommand();

function runSql(sql, { tuplesOnly = false } = {}) {
  const flags = tuplesOnly ? "-t -A" : "";
  return execSync(`${PSQL} -v ON_ERROR_STOP=1 ${flags} -c ${JSON.stringify(sql)}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function sanitizeHtmlForDocx(html) {
  return html
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[\uFFFE\uFFFF]/g, "");
}

async function htmlToDocxBuffer(html) {
  const docx = await HTMLtoDOCX(sanitizeHtmlForDocx(html), null, {
    table: { row: { cantSplit: true } },
    footer: false,
    header: false,
  });
  return Buffer.isBuffer(docx) ? docx : Buffer.from(docx);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = null;
  let titleFilter = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (args[i] === "--title" && args[i + 1]) {
      titleFilter = args[i + 1].toLowerCase();
      i += 1;
    }
  }
  return { limit, titleFilter };
}

function docxPath(authorId, documentId) {
  return path.join(UPLOAD_BASE_PATH, "dockets", authorId, `${documentId}.docx`);
}

function readerPath(authorId, documentId) {
  return path.join(UPLOAD_BASE_PATH, "dockets", authorId, `${documentId}.reader.html`);
}

function legacyPath(authorId, documentId) {
  return path.join(UPLOAD_BASE_PATH, "dockets", authorId, `${documentId}.txt`);
}

function readSourceHtml(authorId, documentId) {
  const readerFile = readerPath(authorId, documentId);
  if (fs.existsSync(readerFile)) {
    return fs.readFileSync(readerFile, "utf8");
  }
  const legacyFile = legacyPath(authorId, documentId);
  if (fs.existsSync(legacyFile)) {
    return fs.readFileSync(legacyFile, "utf8");
  }
  return null;
}

async function main() {
  const { limit, titleFilter } = parseArgs();

  let sql =
    "SELECT d.id::text, d.author_id::text, d.title FROM documents d WHERE d.status = 'PUBLISHED' ORDER BY d.updated_at DESC";
  if (titleFilter) {
    sql = `${sql.replace(" ORDER BY", ` AND LOWER(d.title) LIKE '%${titleFilter.replace(/'/g, "''")}%' ORDER BY`)}`;
  }
  if (limit && Number.isFinite(limit)) {
    sql += ` LIMIT ${limit}`;
  }

  const rowsRaw = runSql(sql, { tuplesOnly: true }).trim();
  if (!rowsRaw) {
    console.log("No published documents matched.");
    return;
  }

  const rows = rowsRaw.split("\n").map((line) => {
    const [id, authorId, ...titleParts] = line.split("|");
    return { id, authorId, title: titleParts.join("|") };
  });

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const outPath = docxPath(row.authorId, row.id);
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      skipped += 1;
      continue;
    }

    const html = readSourceHtml(row.authorId, row.id);
    if (!html?.trim()) {
      console.warn(`skip (no html): ${row.title} (${row.id})`);
      skipped += 1;
      continue;
    }

    process.stdout.write(`converting: ${row.title} … `);
    try {
      const docx = await htmlToDocxBuffer(html);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, docx);
      converted += 1;
      console.log(`ok (${(docx.length / 1024).toFixed(0)} KB)`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`failed — ${message}`);
    }
  }

  console.log(
    `\nDone. converted=${converted} skipped=${skipped} failed=${failed} (upload base: ${UPLOAD_BASE_PATH})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
