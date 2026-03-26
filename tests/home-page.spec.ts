import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set a fake key so we don't get redirected to /setup
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
  });

  test('shows privacy banner', async ({ page }) => {
    await expect(page.getByText('Your queries go directly')).toBeVisible();
    await expect(page.getByText('Privacy Policy')).toBeVisible();
  });

  test('shows Argeon header', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Argeon');
  });

  test('shows empty state with tagline', async ({ page }) => {
    await expect(page.getByText('One question. Many minds.')).toBeVisible();
  });

  test('shows query input', async ({ page }) => {
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ask All' })).toBeVisible();
  });

  test('shows provider chips for configured providers', async ({ page }) => {
    await expect(page.getByText('OpenAI')).toBeVisible();
  });

  test('ask button is disabled with empty input', async ({ page }) => {
    const askButton = page.getByRole('button', { name: 'Ask All' });
    await expect(askButton).toBeDisabled();
  });

  test('ask button enables when text is entered', async ({ page }) => {
    await page.locator('textarea').fill('test question');
    const askButton = page.getByRole('button', { name: 'Ask All' });
    await expect(askButton).toBeEnabled();
  });

  test('redirects to /setup when no keys configured', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await expect(page).toHaveURL('/setup');
  });
});
