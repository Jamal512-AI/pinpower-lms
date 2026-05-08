import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin-only Supabase browser client — MANUAL SINGLETON.
 *
 * We cache the instance ourselves in a module-level variable so that:
 *   1. Every admin page / component gets the exact same client object.
 *   2. The client is created once, reads the token from localStorage once,
 *      and keeps the session alive across navigations.
 *   3. It never collides with the default student client because it uses
 *      a separate storageKey ('sb-admin-auth-token').
 *
 * Using `isSingleton: false` tells @supabase/ssr NOT to reuse the default
 * global singleton (which is the student client). We handle caching ourselves.
 */
let _adminBrowserClient: SupabaseClient | null = null;

export function createAdminBrowserClient(): SupabaseClient {
  if (_adminBrowserClient) return _adminBrowserClient;

  _adminBrowserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,        // don't merge with the student singleton
      cookieOptions: {
        name: 'sb-admin-auth',   // separate cookie name from student
      },
      auth: {
        storageKey: 'sb-admin-auth-token',  // different localStorage key
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,  // admin never does OAuth redirects
      },
    }
  );

  return _adminBrowserClient;
}
