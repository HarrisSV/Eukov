import {
  assertBackendHealthy,
  loginSuperAdmin,
} from "./helpers/eukov-api";
import { loadE2EEnv, resolveSuperAdminCredentials } from "./load-e2e-env";
import { request as playwrightRequest } from "@playwright/test";

export default async function globalSetup(): Promise<void> {
  loadE2EEnv();

  const { password } = resolveSuperAdminCredentials();
  if (!password && !process.env.E2E_ADMIN_EMAIL) {
    throw new Error(
      "E2E setup: set SUPER_ADMIN_PASSWORD in Build/.env (recommended) or " +
        "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD for an existing admin. " +
        "Copy tests/e2e/.env.e2e.example if needed.",
    );
  }

  const requestContext = await playwrightRequest.newContext();
  try {
    await assertBackendHealthy(requestContext);
    if (!process.env.E2E_ADMIN_EMAIL) {
      await loginSuperAdmin(requestContext);
    }
  } catch (err) {
    if (process.env.CI) {
      throw err;
    }
    console.warn(
      `[e2e] ${err instanceof Error ? err.message : err}\n` +
        "Phase 3 tests that need the API will fail until the backend is running " +
        "and super-admin credentials match Build/.env.",
    );
  } finally {
    await requestContext.dispose();
  }
}
