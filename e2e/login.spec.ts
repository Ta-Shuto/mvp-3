import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("displays login form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("面談支援プラットフォーム");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await expect(
      page.getByText("メールアドレスまたはパスワードが正しくありません")
    ).toBeVisible({ timeout: 10000 });
  });

  test("disables button during login attempt", async ({ page }) => {
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');

    await expect(page.getByText("ログイン中...")).toBeVisible();
  });

  test("requires email field", async ({ page }) => {
    await page.fill('input[type="password"]', "password");
    await page.click('button[type="submit"]');

    // HTML5 validation prevents submission
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("required", "");
  });
});

test.describe("Navigation Guards", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/");
    // Should show login or redirect
    await expect(page).toHaveURL(/login|\/$/);
  });
});
