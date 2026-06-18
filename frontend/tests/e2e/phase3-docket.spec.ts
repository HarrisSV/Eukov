import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { injectAuthSession, waitForAuthRole } from "./helpers/auth-session";
import {
  API_BASE,
  assertBackendHealthy,
  createAuthorSession,
  createDocument,
  publishDocument,
  submitUnpublishRequest,
  updateDocument,
  loginUser,
  MIN_PUBLISH_BODY,
  registerUser,
  savePreferences,
  type TestSession,
} from "./helpers/eukov-api";

const password = "password123";

async function openDocket(page: Page, role: string): Promise<void> {
  await page.goto("/dashboard/docket");
  await waitForAuthRole(page, role);
  await page.waitForResponse(
    (r) => r.url().includes("/api/v1/docket") && r.ok(),
    { timeout: 20_000 },
  );
}

async function selectManuscript(
  page: Page,
  title: string,
  sectionTitle: "Drafts" | "Published",
): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ draftTitle, section }) => {
            const sectionEl = [...document.querySelectorAll("aside section")].find(
              (s) => s.querySelector("h2")?.textContent?.trim() === section,
            );
            if (!sectionEl) {
              return false;
            }
            const btn = [...sectionEl.querySelectorAll("button")].find((el) =>
              el.textContent?.includes(draftTitle),
            );
            if (!btn) {
              return false;
            }
            (btn as HTMLButtonElement).click();
            return true;
          },
          { draftTitle: title, section: sectionTitle },
        ),
      { timeout: 20_000 },
    )
    .toBe(true);
}

async function selectDraft(page: Page, title: string): Promise<void> {
  await selectManuscript(page, title, "Drafts");
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible({
    timeout: 15_000,
  });
}

async function selectPublished(page: Page, title: string): Promise<void> {
  await selectManuscript(page, title, "Published");
  await expect(page.getByText("Request unpublish")).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("Phase 3 — Docket, publishing & moderation", () => {
  test.beforeAll(async ({ request }) => {
    await assertBackendHealthy(request);
  });

  test.describe.configure({ mode: "serial" });

  const stamp = Date.now();
  const authorEmail = `p3-author-${stamp}@example.com`;
  const adminEmail = `p3-admin-${stamp}@example.com`;
  const readerEmail = `p3-reader-${stamp}@example.com`;

  let authorSession: TestSession;
  let adminSession: TestSession;
  let readerSession: TestSession;
  let draftTitle: string;
  let shortDraftTitle: string;
  let draftId: string;
  let shortDraftId: string;

  test.beforeAll(async ({ request }) => {
    authorSession = await createAuthorSession(
      request,
      authorEmail,
      password,
      adminEmail,
      password,
    );
    adminSession = await loginUser(request, adminEmail, password);
    await registerUser(request, readerEmail, password);
    readerSession = await loginUser(request, readerEmail, password);
    await savePreferences(request, readerSession, ["history"]);
    draftTitle = `E2E Draft ${stamp}`;
    shortDraftTitle = `Short ${stamp}`;

    const mainDraft = await createDocument(
      request,
      authorSession,
      draftTitle,
      "Initial draft paragraph for E2E.",
    );
    draftId = mainDraft.id;
    const shortDraft = await createDocument(
      request,
      authorSession,
      shortDraftTitle,
      "Too short.",
    );
    shortDraftId = shortDraft.id;
  });

  test("author sees created draft in the docket", async ({ page }) => {
    await injectAuthSession(page, authorSession);
    await openDocket(page, "AUTHOR");

    await expect(page.getByRole("heading", { name: "My Docket" })).toBeVisible();
    await selectDraft(page, draftTitle);
  });

  test("author saves draft changes", async ({ page, request }) => {
    await updateDocument(
      request,
      authorSession,
      draftId,
      draftTitle,
      MIN_PUBLISH_BODY,
    );

    await injectAuthSession(page, authorSession);
    await openDocket(page, "AUTHOR");
    await selectDraft(page, draftTitle);

    await expect(page.locator("section textarea").first()).toHaveValue(
      MIN_PUBLISH_BODY,
      { timeout: 15_000 },
    );

    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.url().includes(`/documents/${draftId}`) &&
          r.ok(),
      ),
      page.evaluate(() => {
        const btn = [...document.querySelectorAll("button")].find(
          (el) => el.textContent?.trim().toUpperCase() === "SAVE",
        );
        if (!btn) {
          throw new Error("Save button not found");
        }
        (btn as HTMLButtonElement).click();
      }),
    ]);
    expect(saveResponse.ok()).toBe(true);
    await expect(page.getByText("Draft saved.")).toBeVisible({ timeout: 10_000 });
  });

  test("metadata validation blocks publish when content is too short", async ({
    request,
  }) => {
    const result = await publishDocument(request, authorSession, shortDraftId, {
      genre: "philosophy",
      tags: ["e2e"],
      title: shortDraftTitle,
      content: "Too short.",
    });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/200|content|length/i);
  });

  test("author publishes manuscript with genre and keywords", async ({
    page,
    request,
  }) => {
    const result = await publishDocument(request, authorSession, draftId, {
      genre: "philosophy",
      tags: ["e2e", "phase3"],
      title: draftTitle,
      content: MIN_PUBLISH_BODY,
    });
    expect(result.status).toBe(200);

    await injectAuthSession(page, authorSession);
    await openDocket(page, "AUTHOR");
    await selectPublished(page, draftTitle);
  });

  test("author submits unpublish request", async ({ request }) => {
    const status = await submitUnpublishRequest(
      request,
      authorSession,
      draftId,
      "E2E test: request removal from public library catalog.",
    );
    expect(status).toBe(201);
  });

  test("admin approves unpublish request in queue", async ({ page }) => {
    await injectAuthSession(page, adminSession);
    await page.goto("/dashboard/admin");

    await expect(page.getByRole("heading", { name: "Author Review Queue" })).toBeVisible();
    await expect(page.getByText("Unpublish moderation")).toBeVisible();

    const row = page.getByRole("row").filter({
      hasText: "E2E test: request removal",
    });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Approve take down" }).click();

    await expect(
      page.getByText("No pending unpublish requests."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("reader cannot access admin review queue", async ({ page }) => {
    await injectAuthSession(page, readerSession);
    await page.goto("/dashboard/admin");

    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Reader Dashboard" })).toBeVisible();
  });

  test("reader cannot create documents via API", async ({ request }) => {
    const res = await request.post(`${API_BASE}/documents`, {
      headers: {
        Authorization: `Bearer ${readerSession.accessToken}`,
        "Content-Type": "application/json",
      },
      data: { title: "Forbidden", content: MIN_PUBLISH_BODY },
    });
    expect(res.status()).toBe(403);
  });

  test("reader docket shows universal workspace without author editor", async ({
    page,
  }) => {
    await injectAuthSession(page, readerSession);
    await openDocket(page, "READER");

    await expect(page.getByRole("heading", { name: "Your Docket" })).toBeVisible();
    await expect(
      page.getByText("Apply for author status to write manuscripts."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Create draft" })).toHaveCount(0);
  });
});
