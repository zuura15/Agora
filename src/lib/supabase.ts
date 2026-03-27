import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth features will be unavailable.');
}

// Use implicit flow so redirectTo works correctly across all environments.
// This is appropriate for a client-side SPA with no server-side secret.
export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  { auth: { flowType: 'implicit' } },
);

// The public URL where this app is hosted.
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
