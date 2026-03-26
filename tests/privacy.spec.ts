import { test, expect } from '@playwright/test';

test.describe('Privacy Page', () => {
  test('shows privacy policy', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.locator('h1')).toContainText('Privacy Policy');
    await expect(page.getByText('What this app is')).toBeVisible();
    await expect(page.getByText('What is stored locally')).toBeVisible();
    await expect(page.getByText('What Argeon does NOT collect')).toBeVisible();
    await expect(page.getByText('What providers may retain')).toBeVisible();
    await expect(page.getByText('What happens when you send a query')).toBeVisible();
    await expect(page.getByText('What changes when you sign in')).toBeVisible();
    await expect(page.getByText('How to delete your local data')).toBeVisible();
  });

  test('has back link to home', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText('Back to Argeon')).toBeVisible();
  });

  test('shows provider retention policies', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.locator('strong').filter({ hasText: 'OpenAI' })).toBeVisible();
    await expect(page.locator('strong').filter({ hasText: 'Anthropic' })).toBeVisible();
    await expect(page.locator('strong').filter({ hasText: 'Google Gemini' })).toBeVisible();
    await expect(page.locator('strong').filter({ hasText: 'xAI (Grok)' })).toBeVisible();
  });

  test('shows contact email', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText('privacy@argeon.app')).toBeVisible();
  });

  test('banner links to privacy page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');

    await page.getByText('Privacy Policy').click();
    await expect(page).toHaveURL('/privacy');
  });
});
