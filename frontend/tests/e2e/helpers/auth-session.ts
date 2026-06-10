import type { Page } from "@playwright/test";
import type { TestSession } from "./eukov-api";

/** Inject Zustand persist session so protected routes load without UI login. */
export async function injectAuthSession(
  page: Page,
  session: TestSession,
): Promise<void> {
  await page.addInitScript((payload) => {
    const persisted = {
      state: {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: payload.user,
      },
      version: 0,
    };
    localStorage.setItem("eukov-auth", JSON.stringify(persisted));
  }, session);
}

export async function waitForAuthRole(
  page: Page,
  role: string,
): Promise<void> {
  await page.waitForFunction(
    (expectedRole) => {
      const raw = localStorage.getItem("eukov-auth");
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw) as {
          state?: { user?: { role?: string } };
        };
        return parsed.state?.user?.role === expectedRole;
      } catch {
        return false;
      }
    },
    role,
    { timeout: 15_000 },
  );
}
