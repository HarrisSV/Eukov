import { expect, test } from "@playwright/test";

test.describe("Full Registration Flow", () => {
  test("register, select genres, and land on dashboard", async ({ page }) => {
    const email = `reader-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/register");

    await page.locator("#firstName").fill("Reader");
    await page.locator("#lastName").fill("Example");
    await page.locator("#nickname").fill("reader");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page).toHaveURL(/\/onboarding\/genres/, { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Choose your interests" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Philosophy", pressed: false }).click();
    await page.getByRole("button", { name: "History", pressed: false }).click();
    await page.getByRole("button", { name: "Continue to Dashboard" }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Reader Dashboard" })).toBeVisible();
    await expect(page.getByText("Welcome back,")).toBeVisible();
    await expect(page.getByText("reader", { exact: true })).toBeVisible();
    await expect(page.getByText("Reader Example")).toBeVisible();
    await expect(page.getByText("Philosophy")).toBeVisible();
    await expect(page.getByText("History")).toBeVisible();
    await expect(page.getByText("Healthy")).toBeVisible();
    await expect(page.getByText("Complete", { exact: true })).toBeVisible();
  });

  test("created account can login from the same register page", async ({ page }) => {
    const email = `login-${Date.now()}@example.com`;
    const password = "password123";

    await page.goto("/register");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();
    await expect(page).toHaveURL(/\/onboarding\/genres/, { timeout: 15_000 });

    await page.goto("/register");
    await page.getByRole("tab", { name: "Login" }).click();
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page).toHaveURL(/\/onboarding\/genres|\/dashboard/, { timeout: 15_000 });
  });
});
