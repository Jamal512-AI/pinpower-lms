import { createBrowserClient } from '@supabase/ssr';

/**
 * Admin-only Supabase browser client.
 *
 * Uses a separate storageKey ('sb-admin-auth-token') so that the admin
 * session is stored in a completely different localStorage slot than the
 * student session ('sb-auth-token'). This prevents the two sessions from
 * ever overwriting each other when admin and student are logged in
 * simultaneously in different tabs of the same browser.
 */
export function createAdminBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      cookieOptions: {
        name: 'sb-admin-auth',   // separate cookie name from student
      },
      auth: {
        storageKey: 'sb-admin-auth-token',  // different localStorage key
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );
}
