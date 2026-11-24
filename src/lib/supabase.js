import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasPartialConfig = Boolean(supabaseUrl) !== Boolean(supabaseKey);

if (hasPartialConfig) {
  console.error('Supabase configuration is incomplete. Set VITE_SUPABASE_URL and a publishable/anon key in .env.');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export async function verifySupabaseConnection() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and a publishable/anon key in .env.');
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
    headers: {
      apikey: supabaseKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase project health check failed: ${response.status} ${response.statusText}`);
  }

  return true;
}
