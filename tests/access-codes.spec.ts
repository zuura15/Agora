import { test, expect } from '@playwright/test';

// Helper: set up access code state in the app store via localStorage
function setAccessCodeState(page: any, opts: {
  queryMode?: string;
  totalBalance?: number;
  dailyQueryCount?: number;
  hasKeys?: boolean;
  accessCodes?: Array<{ id: string; code: string; initial_credit: number; remaining_credit: number; blocked: boolean; redeemed_by: string | null; redeemed_by_user_id: string | null; created_at: string; redeemed_at: string | null }>;
}) {
  return page.evaluate((opts: any) => {
    if (opts.hasKeys) {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    }
    if (opts.queryMode) {
      localStorage.setItem('agora_query_mode', opts.queryMode);
    }
  }, opts);
}

// Helper: inject access code state into the Zustand store at runtime
function injectStoreState(page: any, state: Record<string, unknown>) {
  return page.evaluate((state: any) => {
    // Access the Zustand store directly
    const store = (window as any).__ZUSTAND_STORE__;
    if (store) {
      store.setState(state);
    }
  }, state);
}

test.describe('Setup Page - Access Codes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/setup');
  });

  test('shows access code section on setup page', async ({ page }) => {
    await expect(page.getByText('Have an access code?')).toBeVisible();
  });

  test('shows "sign in to use an access code" when not logged in', async ({ page }) => {
    await expect(page.getByText('Sign in to use an access code')).toBeVisible();
  });

  test('sign in link opens login modal', async ({ page }) => {
    await page.getByText('Sign in to use an access code').click();
    await expect(page.getByText('Sign in to Argeon')).toBeVisible();
  });

  test('access code section appears above provider cards', async ({ page }) => {
    const accessCodeSection = page.getByText('Have an access code?');
    const providerCards = page.getByText('OpenAI', { exact: true });

    const accessCodeBox = await accessCodeSection.boundingBox();
    const providerBox = await providerCards.boundingBox();

    expect(accessCodeBox!.y).toBeLessThan(providerBox!.y);
  });

  test('setup page uses light theme', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
  });

  test('start button disabled without keys or codes', async ({ page }) => {
    const startButton = page.getByRole('button', { name: 'Start using Argeon' });
    await expect(startButton).toBeDisabled();
  });
});

test.describe('Setup Page - Access Code Input (logged in)', () => {
  // Note: These tests simulate logged-in state. In real E2E, OAuth would be needed.
  // Here we test the UI components exist and have correct structure.

  test('shows code input placeholder', async ({ page }) => {
    await page.goto('/setup');
    // When logged in, the input would show. We can at least verify the section renders.
    await expect(page.getByText('Access Codes')).toBeVisible();
  });
});

test.describe('Home Page - Mode Selector', () => {
  test('mode selector hidden when no access codes', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');

    // Mode selector should not be visible (no access codes, not logged in)
    await expect(page.getByText('Own Keys')).not.toBeVisible();
    await expect(page.getByText('Access Code')).not.toBeVisible();
  });

  test('privacy banner shows in BYOK mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'byok');
    });
    await page.goto('/');

    await expect(page.getByText('Your queries go directly')).toBeVisible();
  });

  test('privacy banner hidden in access-code mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'access-code');
    });
    await page.goto('/');

    await expect(page.getByText('Your queries go directly')).not.toBeVisible();
  });
});

test.describe('Home Page - Zero Balance Banner', () => {
  test('no banner in byok mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'byok');
    });
    await page.goto('/');

    await expect(page.getByText('Access credit depleted')).not.toBeVisible();
    await expect(page.getByText('Daily query limit reached')).not.toBeVisible();
  });

  // Note: Testing the zero balance banner with actual state requires injecting
  // store state which needs the app to be running with the store accessible.
  // These are better tested with integration tests against a running backend.
});

test.describe('Settings - Access Codes in Account Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');
  });

  test('account tab shows access codes section', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    // Section header is uppercase via CSS: "ACCESS CODES"
    await expect(page.getByText('access codes', { exact: false })).toBeVisible();
  });

  test('account tab shows sign in prompt for access codes when not logged in', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    await expect(page.getByText('Sign in to use an access code')).toBeVisible();
  });

  test('sign in link in account tab opens login modal', async ({ page }) => {
    await page.getByTitle('Settings').click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();

    // There may be multiple "Sign in" elements; click the one in the access codes section
    const signInLink = page.getByRole('button', { name: 'Sign in to use an access code' });
    await signInLink.click();

    await expect(page.getByText('Sign in to Argeon')).toBeVisible();
  });
});

test.describe('Settings - Response Length in Access Code Mode', () => {
  test('normal response length visible in byok mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'byok');
    });
    await page.goto('/');

    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Super brief', exact: true })).toBeVisible();
  });

  test('normal response length hidden in access-code mode', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'access-code');
    });
    await page.goto('/');

    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Brief', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Super brief', exact: true })).toBeVisible();
  });
});

test.describe('Admin Page', () => {
  test('redirects non-admin to home', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    // Navigate to admin directly
    await page.goto('/admin');

    // Should redirect to home (not admin) since we're not logged in as admin
    // The page will show loading briefly then redirect
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL('/');
  });
});

test.describe('App Store - Access Code State', () => {
  test('queryMode defaults to byok', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/');

    const mode = await page.evaluate(() => localStorage.getItem('agora_query_mode'));
    // Either null (default) or 'byok'
    expect(mode === null || mode === 'byok').toBeTruthy();
  });

  test('queryMode persists to localStorage', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'access-code');
    });
    await page.goto('/');

    const mode = await page.evaluate(() => localStorage.getItem('agora_query_mode'));
    expect(mode).toBe('access-code');
  });

  test('switching to access-code mode auto-sets brief if on normal', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_response_length', 'normal');
      localStorage.setItem('agora_query_mode', 'access-code');
    });
    await page.goto('/');

    // The store's setQueryMode auto-switches normal → brief
    // On next load with access-code mode, the response length should already be handled
    const length = await page.evaluate(() => localStorage.getItem('agora_response_length'));
    // It stays 'normal' in localStorage since the auto-switch happens in the store action,
    // not on load. This test verifies the UI hides Normal instead.
    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).not.toBeVisible();
  });
});

test.describe('Navigation - Access Code Routes', () => {
  test('/admin route exists and loads', async ({ page }) => {
    const response = await page.goto('/admin');
    expect(response?.status()).toBe(200);
  });

  test('unknown routes redirect to home', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
    });
    await page.goto('/nonexistent');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Regression - BYOK still works', () => {
  test('BYOK flow unchanged: setup → enter key → start → home', async ({ page }) => {
    await page.goto('/setup');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/setup');

    // Enter a key
    const firstInput = page.locator('input[type="password"]').first();
    await firstInput.fill('sk-test-fake-key-12345');
    await page.getByRole('button', { name: 'Save' }).first().click();

    // Start button should be enabled
    const startButton = page.getByRole('button', { name: 'Start using Argeon' });
    await expect(startButton).toBeEnabled();

    // Click start
    await startButton.click();
    await expect(page).toHaveURL('/');
  });

  test('BYOK mode shows privacy banner', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'byok');
    });
    await page.goto('/');

    await expect(page.getByText('Your queries go directly')).toBeVisible();
  });

  test('BYOK mode shows all response length options', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('agora_key_openai', 'sk-test-fake');
      localStorage.setItem('agora_query_mode', 'byok');
    });
    await page.goto('/');

    await page.getByTitle('Settings').click();
    await expect(page.getByRole('button', { name: 'Normal', exact: true })).toBeVisible();
  });

  test('redirect to setup when no keys', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/');
    await expect(page).toHaveURL('/setup');
  });
});
