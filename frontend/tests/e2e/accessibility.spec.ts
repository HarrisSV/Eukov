import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Accessibility", () => {
  test("register page has no critical accessibility violations", async ({ page }) => {
    await page.goto("/register");
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("keyboard navigation reaches register and login controls", async ({ page }) => {
    await page.goto("/register");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tab", { name: "Register" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("tab", { name: "Login" })).toBeFocused();
  });
});
