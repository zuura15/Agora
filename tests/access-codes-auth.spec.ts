import { test, expect } from '@playwright/test';
import { loginAsTestUser, SUPABASE_URL } from './auth-helper';

// These tests require Supabase credentials in env vars.
// Skip gracefully if not available.
const hasSupabase = !!SUPABASE_URL;

test.describe('Authenticated Access Code Flows', () => {
  test.skip(!hasSupabase, 'Supabase env vars not set — skipping authenticated tests');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn, 'Could not authenticate test user');
    await page.goto('/');
  });

  test('logged-in user sees access code input in settings', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    // Should see the code input field (not the "sign in" prompt)
    await expect(page.getByPlaceholder('AGORA-XXXX-XXXX')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Redeem' })).toBeVisible();
  });

  test('logged-in user sees access code input on setup page', async ({ page }) => {
    await page.goto('/setup');
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn);
    await page.goto('/setup');

    await expect(page.getByPlaceholder('AGORA-XXXX-XXXX')).toBeVisible();
  });

  test('redeem button disabled with empty input', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    const redeemBtn = page.getByRole('button', { name: 'Redeem' });
    await expect(redeemBtn).toBeDisabled();
  });

  test('invalid code shows error message', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    await page.getByPlaceholder('AGORA-XXXX-XXXX').fill('INVALID-CODE');
    await page.getByRole('button', { name: 'Redeem' }).click();

    // Should show an error (the exact message depends on server response)
    await expect(page.getByText(/invalid|not found|failed/i)).toBeVisible({ timeout: 10000 });
  });

  test('shows "Up to 3 active access codes" hint', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    await expect(page.getByText('Up to 3 active access codes')).toBeVisible();
  });

  test('code input auto-uppercases text', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    const input = page.getByPlaceholder('AGORA-XXXX-XXXX');
    await input.fill('agora-test-1234');
    await expect(input).toHaveValue('AGORA-TEST-1234');
  });

  test('mode selector not visible without active codes', async ({ page }) => {
    // User is logged in but has no access codes
    await expect(page.getByText('Own Keys')).not.toBeVisible();
    await expect(page.getByText(/Access Code ·/)).not.toBeVisible();
  });

  test('privacy banner visible when logged in without access codes (byok mode)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn);
    await page.goto('/');

    await expect(page.getByText('Your queries go directly')).toBeVisible();
  });

  test('user menu shows for logged in user', async ({ page }) => {
    // Should see avatar or initial, not "Sign in"
    await expect(page.getByText('Sign in')).not.toBeVisible();
  });
});

test.describe('Admin Page - Authenticated', () => {
  test.skip(!hasSupabase, 'Supabase env vars not set');

  test('non-admin user gets redirected from /admin', async ({ page }) => {
    await page.goto('/');
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn, 'Could not authenticate test user');

    await page.goto('/admin');
    // Test user is not admin, should redirect
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL('/');
  });
});

test.describe('Access Code Mode State - Authenticated', () => {
  test.skip(!hasSupabase, 'Supabase env vars not set');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn);
  });

  test('response length selector hides Normal in access-code mode', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'access-code');
      // Mark migration as done to prevent dialog overlay
      localStorage.setItem('agora_migration_done', 'true');
    });
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn);
    await page.goto('/');

    // Dismiss any overlay that might appear
    const overlay = page.locator('.fixed.inset-0');
    if (await overlay.isVisible({ timeout: 1000 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
  });

  test('zero balance banner not shown when balance is positive or in byok mode', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
    const loggedIn = await loginAsTestUser(page);
    test.skip(!loggedIn);
    await page.goto('/');

    await expect(page.getByText('Access credit depleted')).not.toBeVisible();
    await expect(page.getByText('Daily query limit reached')).not.toBeVisible();
  });
});
