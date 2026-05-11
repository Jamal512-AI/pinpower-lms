import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _sharedClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (_sharedClient) return _sharedClient;

  _sharedClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return _sharedClient;
}
