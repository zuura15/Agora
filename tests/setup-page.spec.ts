import { test, expect } from '@playwright/test';

test.describe('Setup Page', () => {
  test('shows setup page when no keys configured', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => {
      localStorage.clear();
      indexedDB.deleteDatabase('AgoraDB');
    });
    await page.goto('/setup');

    await expect(page.locator('h1')).toContainText('Set up your AI providers');
    await expect(page.getByText('Argeon sends your queries')).toBeVisible();
  });

  test('shows all 4 provider cards', async ({ page }) => {
    await page.goto('/setup');

    await expect(page.getByText('OpenAI', { exact: true })).toBeVisible();
    await expect(page.getByText('Anthropic', { exact: true })).toBeVisible();
    await expect(page.getByText('Google Gemini', { exact: true })).toBeVisible();
    await expect(page.getByText('xAI (Grok)', { exact: true })).toBeVisible();
  });

  test('start button is disabled without keys', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/setup');

    const startButton = page.getByRole('button', { name: 'Start using Argeon' });
    await expect(startButton).toBeDisabled();
  });

  test('start button enables after entering a key', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/setup');

    // Type a fake key into the first provider input
    const firstInput = page.locator('input[type="password"]').first();
    await firstInput.fill('sk-test-fake-key-12345');

    // Click Save
    await page.getByRole('button', { name: 'Save' }).first().click();

    const startButton = page.getByRole('button', { name: 'Start using Argeon' });
    await expect(startButton).toBeEnabled();
  });

  test('navigates to home after clicking start', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/setup');

    await page.getByRole('button', { name: 'Start using Argeon' }).click();
    await expect(page).toHaveURL('/');
  });

  test('show/copy buttons appear for saved keys', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-visible');
    });
    await page.goto('/setup');

    await expect(page.getByText('Show').first()).toBeVisible();
    await expect(page.getByText('Copy').first()).toBeVisible();
  });

  test('show button reveals the key', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-reveal');
    });
    await page.goto('/setup');

    // Key should be masked
    const input = page.locator('input[type="password"]').first();
    await expect(input).toHaveAttribute('type', 'password');

    // Click Show
    await page.getByText('Show').first().click();

    // Now should be visible
    const visibleInput = page.locator('input[type="text"]').first();
    await expect(visibleInput).toHaveValue('sk-test-reveal');
  });
});
