import { expect, test } from "@playwright/test";

test.describe("User Registration", () => {
  test("registration form renders and validates", async ({ page }) => {
    await page.goto("/register");

    await expect(
      page.getByRole("heading", { name: "Create your account" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });
});

test.describe("Theme Toggle", () => {
  test("UI updates when theme is toggled", async ({ page }) => {
    await page.goto("/register");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });
});

test.describe("Responsive Validation", () => {
  test("layout adapts on minimum mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
