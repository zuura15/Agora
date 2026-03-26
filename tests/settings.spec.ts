import { test, expect } from '@playwright/test';

test.describe('Settings Drawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
  });

  test('opens settings drawer', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await expect(page.locator('h2').filter({ hasText: 'Settings' })).toBeVisible();
  });

  test('shows all 4 tabs', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'General', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Display', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Data', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeVisible();
  });

  test('closes settings drawer', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByText('Close').click();
    // Drawer should be gone
    await expect(page.locator('h2').filter({ hasText: 'Settings' })).not.toBeVisible();
  });

  test('general tab shows response length options', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Super brief', exact: true })).toBeVisible();
  });

  test('general tab shows temperature slider', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test('general tab shows send shortcut options', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Enter', exact: true })).toBeVisible();
  });

  test('display tab shows theme and layout options', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Display', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Dark', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Light', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Auto', exact: true })).toBeVisible();
  });

  test('data tab shows export and clear buttons', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Data', exact: true }).click();
    await expect(page.getByText('Export history as JSON')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear All Data' })).toBeVisible();
  });

  test('data tab shows auto-clear options', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Data', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Never', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '7 days', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 days', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '90 days', exact: true })).toBeVisible();
  });

  test('account tab shows sign in when not logged in', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    // The sign in button in the Account tab (not the header one)
    await expect(page.getByText('Sign in to sync your API keys')).toBeVisible();
  });

  test('response length persists after selection', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Normal', exact: true }).click();

    // Reload and verify
    await page.goto('/');
    await page.getByTitle('Settings').click();
    const normalBtn = page.getByRole('button', { name: 'Normal', exact: true });
    await expect(normalBtn).toHaveClass(/bg-accent/);
  });
});

test.describe('Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
  });

  test('toggles between dark and light theme', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', 'light');

    await page.getByTitle('Switch to light mode').click();
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByTitle('Switch to dark mode').click();
    await expect(html).not.toHaveAttribute('data-theme', 'light');
  });

  test('theme persists across page reload', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('agora_theme', 'light');
    });
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
  });
});
