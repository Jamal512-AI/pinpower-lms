import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Check role and status
  const { data: profile } = await supabase
    .from('users_extended')
    .select('role, access_status')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (profile.role === 'admin') redirect('/admin');
  if (profile.access_status === 'pending') redirect('/waiting-room');
  if (profile.access_status === 'approved') redirect('/dashboard');

  redirect('/login');
}
