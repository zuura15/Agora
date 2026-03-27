import { createClient } from '@supabase/supabase-js';

// IMPORTANT: .trim() prevents "TypeError: Failed to execute 'fetch' on 'Window':
// Invalid value" errors caused by trailing newlines or whitespace in env vars.
// This is common when env vars are copy-pasted into hosting dashboards (e.g. Vercel).
// A newline in the anon key produces an illegal character in HTTP headers (apikey,
// Authorization), which the browser rejects before the request is even sent.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth features will be unavailable.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      flowType: 'implicit',
      detectSessionInUrl: true,
      debug: import.meta.env.DEV,
    },
  },
);
