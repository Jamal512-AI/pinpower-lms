import { createServerClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ─── Singleton Admin Client ────────────────────────────────────────────────────
// We reuse a single admin client across all requests in the same serverless
// instance instead of creating a new one on every call. This reduces cold-start
// latency and connection overhead under concurrent student load.
let _adminClient: SupabaseClient | null = null;

export function getAdminSupabaseClient(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          // Disable session persistence for server-side admin client
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return _adminClient;
}

// Keep backward compatibility alias
export async function createAdminSupabaseClient(): Promise<SupabaseClient> {
  return getAdminSupabaseClient();
}

// ─── Per-Request Server Client (uses cookie session) ─────────────────────────
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        name: 'sb-auth-token',
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
