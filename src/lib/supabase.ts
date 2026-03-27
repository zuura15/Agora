import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth features will be unavailable.');
}

// In dev, use implicit flow so redirectTo works with any local URL.
// In production, use PKCE (default) for better security.
const isDev = import.meta.env.DEV;

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  isDev ? { auth: { flowType: 'implicit' } } : undefined,
);

// The public URL where this app is hosted.
export const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;
