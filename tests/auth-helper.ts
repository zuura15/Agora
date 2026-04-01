import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

// These point to the HOSTED Supabase instance (same as the app)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const TEST_EMAIL = 'test-playwright@argeon.test';
const TEST_PASSWORD = 'test-password-argeon-2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sign up the test user (idempotent — succeeds if already exists).
 * Call this once before the test suite, e.g. in globalSetup.
 */
export async function ensureTestUser() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase env vars not set — skipping test user creation');
    return null;
  }

  // Try sign in first (user may already exist)
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signInData?.session) return signInData.session;

  // If sign in fails, sign up
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (signUpError) {
    console.warn('Failed to create test user:', signUpError.message);
    return null;
  }

  // Sign in after sign up
  const { data } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  return data?.session || null;
}

/**
 * Inject an authenticated session into the browser page.
 * This sets the Supabase session in localStorage so the app picks it up.
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return false;
  }

  // Get a fresh session server-side
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error || !data.session) {
    console.warn('Failed to get test session:', error?.message);
    return false;
  }

  const session = data.session;

  // Inject the session into the page's localStorage (Supabase stores session here)
  await page.evaluate((sessionData) => {
    const storageKey = `sb-${new URL(sessionData.supabaseUrl).hostname.split('.')[0]}-auth-token`;
    localStorage.setItem(storageKey, JSON.stringify({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
      expires_at: sessionData.expires_at,
      expires_in: sessionData.expires_in,
      token_type: 'bearer',
      user: sessionData.user,
    }));
  }, {
    supabaseUrl: SUPABASE_URL,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    user: session.user,
  });

  return true;
}

export { TEST_EMAIL, TEST_PASSWORD, SUPABASE_URL, SUPABASE_ANON_KEY };
