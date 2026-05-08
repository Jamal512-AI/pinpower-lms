import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Student / default Supabase browser client — uses the library's built-in
 * singleton so that all student pages share the same instance & session.
 */
let _studentClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_studentClient) return _studentClient;

  _studentClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return _studentClient;
}
