import { test, expect } from '@playwright/test';

test.describe('Auth UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: `
        *,
        *::before,
        *::after {
          animation: none !important;
          transition: none !important;
          scroll-behavior: auto !important;
        }
      `,
    });
  });

  test('login tab baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#authView')).toHaveClass(/active/);
    await expect(page.locator('#loginForm')).toBeVisible();
    await expect(page.locator('#registerForm')).toBeHidden();

    await expect(page).toHaveScreenshot('auth-login.png', {
      fullPage: true,
    });
  });

  test('register tab baseline', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.locator('#registerForm')).toBeVisible();
    await expect(page.locator('#loginForm')).toBeHidden();

    await expect(page).toHaveScreenshot('auth-register.png', {
      fullPage: true,
    });
  });
});
