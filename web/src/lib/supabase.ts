import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.error('ERROR: Invalid or missing NEXT_PUBLIC_SUPABASE_URL. Please check your .env.local file.');
}

// Only create the client if we have a valid URL to avoid crashing the app
export const supabase: SupabaseClient = (supabaseUrl && supabaseUrl.startsWith('http'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

export default supabase;
