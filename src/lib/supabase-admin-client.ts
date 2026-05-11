import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a fresh (non-singleton) Supabase browser client for admin pages.
 *
 * KEY DESIGN DECISIONS:
 * 1. isSingleton: false — admin client must NEVER share the student singleton.
 *    If a student was logged in previously on same browser, the singleton in
 *    supabase.ts caches their session. Admin pages reading that singleton would
 *    get "NOT_ADMIN: role is student" — the exact bug we're fixing.
 *
 * 2. No custom storageKey/cookieOptions — the login page (/login) uses the
 *    default Supabase cookie. Admin client must read the same cookie.
 *
 * 3. Not cached globally — each admin page component creates its own instance.
 *    This ensures no cross-contamination between admin and student sessions,
 *    and supports 100+ concurrent students + multiple admins simultaneously.
 */
export function createAdminBrowserClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
    }
  );
}
