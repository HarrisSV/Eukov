import fs from "node:fs";
import path from "node:path";

function applyEnvFile(filePath: string, overrideExisting: boolean): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) {
      continue;
    }
    if (overrideExisting || !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Loads credentials from the same sources as local backend dev:
 * 1. Build/.env (monorepo root — do not override shell/CI env)
 * 2. tests/e2e/.env.e2e (optional overrides)
 */
export function loadE2EEnv(): void {
  const monorepoEnv = path.resolve(__dirname, "../../../.env");
  const e2eEnv = path.join(__dirname, ".env.e2e");

  applyEnvFile(monorepoEnv, false);
  applyEnvFile(e2eEnv, true);
}

export function resolveSuperAdminCredentials(): {
  email: string;
  password: string;
  sources: string[];
} {
  const sources: string[] = [];
  const email = process.env.SUPER_ADMIN_EMAIL ?? "superadmin@eukov.local";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";

  if (process.env.SUPER_ADMIN_EMAIL) {
    sources.push("SUPER_ADMIN_EMAIL env");
  }
  if (process.env.SUPER_ADMIN_PASSWORD) {
    sources.push("SUPER_ADMIN_PASSWORD env");
  }

  const monorepoEnv = path.resolve(__dirname, "../../../.env");
  const e2eEnv = path.join(__dirname, ".env.e2e");
  if (fs.existsSync(monorepoEnv)) {
    sources.push(`Build/.env (${monorepoEnv})`);
  }
  if (fs.existsSync(e2eEnv)) {
    sources.push(`tests/e2e/.env.e2e`);
  }

  return { email, password, sources };
}
