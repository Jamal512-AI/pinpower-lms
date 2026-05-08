import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';
dotenv.config({ path: '.env.local' });
global.WebSocket = WebSocket;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function confirmAllUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  for (const user of data.users) {
    if (!user.email_confirmed_at) {
      console.log(`Confirming email for ${user.email}...`);
      await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true
      });
      console.log(`Confirmed ${user.email}!`);
    }
  }
  console.log('Done confirming users.');
}

confirmAllUsers();
