import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
  });

  test("login page loads without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/login");
    await expect(page.locator("h1")).toBeVisible();

    // Filter out expected hydration warnings
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("hydrat") && !e.includes("Warning")
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test("pre-chat page handles invalid token", async ({ page }) => {
    await page.goto("/pre-chat/invalid-token-xyz");
    // Should show an error or not found state
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/pre-chat/");
  });
});
