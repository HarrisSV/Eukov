#!/usr/bin/env node
/**
 * Backfills document_metadata.author_name for existing published books:
 * - Lorem ipsum scripts → "Suyash Verma"
 * - Gutenberg books (gutenberg-{id} tag) → original author from Gutendex
 *
 * Usage: node scripts/backfill-author-names.mjs
 * Requires: migration 000026 applied, psql on PATH, Postgres running.
 */

import { execSync } from "node:child_process";
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
const DATABASE_URL =
  process.env.DATABASE_URL ??
  env.DATABASE_URL ??
  "postgres://eukov:eukov_secret@localhost:5432/eukov";

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

function escapeSql(value) {
  return value.replace(/'/g, "''");
}

async function fetchGutenbergAuthor(gutenbergId) {
  const res = await fetch(`https://gutendex.com/books/${gutenbergId}/`);
  if (!res.ok) {
    throw new Error(`Gutendex ${gutenbergId}: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.authors?.[0]?.name ?? null;
}

async function main() {
  console.log("Backfilling author names…");

  const loremResult = runSql(
    "UPDATE document_metadata dm SET author_name = 'Suyash Verma' FROM documents d WHERE d.id = dm.document_id AND d.status = 'PUBLISHED' AND LOWER(d.title) LIKE '%lorem ipsum%'",
  );
  console.log(loremResult.trim() || "Lorem ipsum: no rows updated");

  const rowsRaw = runSql(
    "SELECT DISTINCT d.id::text, regexp_replace(dt.tag, '^gutenberg-', '') AS gid FROM documents d JOIN document_tags dt ON dt.document_id = d.id JOIN document_metadata dm ON dm.document_id = d.id WHERE d.status = 'PUBLISHED' AND dt.tag ~ '^gutenberg-[0-9]+$' AND COALESCE(dm.author_name, '') = '' ORDER BY gid",
    { tuplesOnly: true },
  );

  const rows = rowsRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [documentId, gutenbergId] = line.split("|");
      return { documentId, gutenbergId };
    });

  console.log(`Gutenberg books needing author: ${rows.length}`);

  let updated = 0;
  for (const { documentId, gutenbergId } of rows) {
    try {
      const author = await fetchGutenbergAuthor(gutenbergId);
      if (!author) {
        console.log(`  skip ${gutenbergId}: no author in Gutendex`);
        continue;
      }
      runSql(
        `UPDATE document_metadata SET author_name = '${escapeSql(author)}' WHERE document_id = '${documentId}'`,
      );
      updated += 1;
      console.log(`  ${gutenbergId}: ${author}`);
    } catch (error) {
      console.log(`  skip ${gutenbergId}: ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`Done. Gutenberg authors set: ${updated}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
