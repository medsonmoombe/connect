import { createBrowserClient } from '@supabase/ssr';

// DB/realtime client only — do NOT use for auth operations.
// All auth goes through /api/auth/* routes so the provider is swappable.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const supabase = createClient();
export default supabase;
