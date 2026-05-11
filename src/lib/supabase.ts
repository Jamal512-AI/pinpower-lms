import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Student Supabase browser client — singleton for student pages only.
 *
 * IMPORTANT: This singleton is for STUDENT pages only (/dashboard, /chat, /waiting-room).
 * Admin pages use createAdminBrowserClient() from supabase-admin-client.ts which
 * sets isSingleton: false so it never reads this cached student session.
 */
let _sharedClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_sharedClient) return _sharedClient;

  _sharedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
    }
  );

  return _sharedClient;
}
