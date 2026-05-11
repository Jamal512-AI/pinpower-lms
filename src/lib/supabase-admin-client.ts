import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase browser client.
 *
 * IMPORTANT: Must use the SAME storage key as the student client (`createClient`)
 * because the login page (/login) uses createClient() to sign in.
 * The session cookie is set there, and admin pages must read from the same place.
 *
 * Previously this used a separate storageKey ('sb-admin-auth-token') and
 * separate cookie name ('sb-admin-auth'), which caused getUser() to return null
 * even though the session cookie existed — it was just stored under a different key.
 */
let _adminBrowserClient: SupabaseClient | null = null;

export function createAdminBrowserClient(): SupabaseClient {
  if (_adminBrowserClient) return _adminBrowserClient;

  _adminBrowserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return _adminBrowserClient;
}
